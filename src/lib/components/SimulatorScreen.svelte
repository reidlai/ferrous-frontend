<script lang="ts">
	import { Activity, Database, Eye, Terminal } from 'lucide-svelte';
	import {
		createRadarStore,
		OLIST_DELTA_TABLES,
		radarStore
	} from '$lib/stores/radar.svelte';
	import { REPLAY_QUICKSTART_URL } from '$lib/stores/workspace.svelte';

	interface SimulatorScreenProps {
		store?: ReturnType<typeof createRadarStore>;
	}

	let { store = radarStore }: SimulatorScreenProps = $props();

	const progressPct = $derived(
		store.topicStatus.profileTotalEvents > 0
			? ((store.topicStatus.currentOffset / store.topicStatus.profileTotalEvents) * 100).toFixed(1)
			: '0.0'
	);
</script>

<section
	data-testid="screen-simulator"
	aria-label="Olist Replay Monitor"
	class="flex-1 bg-[#0B0F17] p-6 text-slate-100"
>
	<header
		class="flex flex-col gap-4 border-b border-slate-800/80 pb-5 lg:flex-row lg:items-center lg:justify-between"
	>
		<div>
			<div class="flex items-center gap-2">
				<Eye class="h-4 w-4 text-emerald-400" aria-hidden="true" />
				<span class="font-mono text-[11px] tracking-wider text-emerald-300 uppercase">
					Screen 4 · Read-Only Olist Replay Monitor
				</span>
			</div>
			<h1 class="mt-1 text-xl font-semibold text-slate-50">
				Olist Stream &amp; Delta Lake Monitor
			</h1>
			<p class="mt-1 text-xs text-slate-400">
				Passive telemetry inspector for Apache Iggy stream replay and Arroyo Delta Lake ingestion.
			</p>
		</div>

		<!-- Read-Only ReplayStatusPill -->
		<div
			data-testid="replay-status-pill"
			class="inline-flex flex-wrap items-center gap-2.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-mono text-xs text-emerald-200"
		>
			<span class="h-2 w-2 rounded-full bg-emerald-400"></span>
			<span class="font-semibold">STREAMING (READ-ONLY)</span>
			<span class="text-slate-400">·</span>
			<span class="text-slate-200">{store.topicStatus.topic}</span>
			<span class="text-slate-400">·</span>
			<span class="text-emerald-300">{store.topicStatus.throughputMsgsPerSec} msgs/s</span>
			<span class="text-slate-400">·</span>
			<span class="text-slate-200">{progressPct}%</span>
		</div>
	</header>

	<!-- Apache Iggy Topic & Consumer Group Inspector -->
	<div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
		<article
			data-testid="iggy-topic-inspector"
			class="rounded-xl border border-slate-800/80 bg-slate-900/70 p-5"
		>
			<div class="flex items-center justify-between border-b border-slate-800 pb-3">
				<div class="flex items-center gap-2">
					<Activity class="h-4 w-4 text-amber-400" aria-hidden="true" />
					<h2 class="text-sm font-semibold text-slate-50">Apache Iggy Topic Inspector</h2>
				</div>
				<span class="rounded bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-amber-300">
					{store.topicStatus.topic}
				</span>
			</div>

			<dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
					<dt class="font-mono text-[10px] text-slate-400 uppercase">Partitions</dt>
					<dd class="mt-1 font-mono text-lg font-bold text-slate-100">
						{store.topicStatus.partitions}
					</dd>
				</div>
				<div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
					<dt class="font-mono text-[10px] text-slate-400 uppercase">Replay Rate</dt>
					<dd class="mt-1 font-mono text-lg font-bold text-emerald-300">
						{store.topicStatus.throughputMsgsPerSec} msgs/s
					</dd>
				</div>
				<div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
					<dt class="font-mono text-[10px] text-slate-400 uppercase">Offset / Profile</dt>
					<dd class="mt-1 font-mono text-sm font-bold text-slate-100">
						{store.topicStatus.currentOffset.toLocaleString('en-US')} / {store.topicStatus.profileTotalEvents.toLocaleString('en-US')} ({progressPct}%)
					</dd>
				</div>
				<div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
					<dt class="font-mono text-[10px] text-slate-400 uppercase">High Watermark</dt>
					<dd class="mt-1 font-mono text-lg font-bold text-amber-300">
						{store.topicStatus.highWatermark.toLocaleString('en-US')}
					</dd>
				</div>
			</dl>
		</article>

		<article
			data-testid="consumer-group-inspector"
			class="rounded-xl border border-slate-800/80 bg-slate-900/70 p-5"
		>
			<div class="flex items-center justify-between border-b border-slate-800 pb-3">
				<div class="flex items-center gap-2">
					<Activity class="h-4 w-4 text-emerald-400" aria-hidden="true" />
					<h2 class="text-sm font-semibold text-slate-50">Consumer Group Lag</h2>
				</div>
				<span class="rounded bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
					{store.topicStatus.consumerGroup}
				</span>
			</div>

			<dl class="mt-4 grid grid-cols-2 gap-3">
				<div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
					<dt class="font-mono text-[10px] text-slate-400 uppercase">Current Lag</dt>
					<dd class="mt-1 font-mono text-lg font-bold text-emerald-300">
						{store.topicStatus.consumerLagMsgs} msgs
					</dd>
				</div>
				<div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
					<dt class="font-mono text-[10px] text-slate-400 uppercase">Inspection Mode</dt>
					<dd class="mt-1 font-mono text-lg font-bold text-slate-200 uppercase">
						{store.topicStatus.mode}
					</dd>
				</div>
			</dl>
		</article>
	</div>

	<!-- olist_* Delta Lake Tables Monitor -->
	<section
		data-testid="delta-tables-monitor"
		aria-label="Olist Delta Lake Tables"
		class="mt-6 rounded-xl border border-slate-800/80 bg-slate-900/70 p-5"
	>
		<div class="flex items-center gap-2 border-b border-slate-800 pb-3">
			<Database class="h-4 w-4 text-amber-400" aria-hidden="true" />
			<h2 class="text-sm font-semibold text-slate-50">Olist Delta Lake Tables</h2>
		</div>

		<div class="mt-4 overflow-x-auto">
			<table class="w-full border-collapse text-left text-xs">
				<thead class="border-b border-slate-800 font-mono text-[11px] text-slate-400 uppercase">
					<tr>
						<th scope="col" class="px-3 py-2.5">Table</th>
						<th scope="col" class="px-3 py-2.5">Row Count</th>
						<th scope="col" class="px-3 py-2.5">Partitions</th>
						<th scope="col" class="px-3 py-2.5">Latest Commit</th>
						<th scope="col" class="px-3 py-2.5">Updated</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800/70 font-mono">
					{#each OLIST_DELTA_TABLES as table (table.tableName)}
						<tr data-testid="delta-table-row-{table.tableName}">
							<td class="px-3 py-2.5 font-semibold text-slate-100">{table.tableName}</td>
							<td class="px-3 py-2.5 text-slate-300">
								{table.rowCount.toLocaleString('en-US')}
							</td>
							<td class="px-3 py-2.5 text-slate-300">{table.partitionCount}</td>
							<td class="px-3 py-2.5 text-amber-300">v{table.latestVersion}</td>
							<td class="px-3 py-2.5 text-slate-400">{table.lastCommitAgo}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<!-- CLI Quickstart Reference Card -->
	<section
		data-testid="replay-quickstart-card"
		aria-label="CLI Stream Replay Quickstart"
		class="mt-6 rounded-xl border border-slate-800/80 bg-slate-900/70 p-5"
	>
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-start gap-3">
				<Terminal class="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
				<div>
					<h2 class="text-sm font-semibold text-slate-50">
						CLI-Driven Stream Replay ({store.topicStatus.quickstartRepo})
					</h2>
					<p class="mt-1 text-xs text-slate-400">
						This view is strictly read-only. Control and manage Olist event stream ingestion from your terminal using
						<code class="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-amber-300">
							{store.topicStatus.quickstartCommand}
						</code>
						or
						<code class="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-amber-300">
							{store.topicStatus.quickstartBinary}
						</code>.
					</p>
				</div>
			</div>

			<a
				href={REPLAY_QUICKSTART_URL}
				target="_blank"
				rel="noreferrer"
				class="inline-flex shrink-0 items-center rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200 transition hover:border-amber-500/60 hover:text-amber-200"
			>
				ferrous-cx Quickstart
			</a>
		</div>
	</section>
</section>
