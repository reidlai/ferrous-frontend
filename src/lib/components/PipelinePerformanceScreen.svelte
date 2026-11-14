<script lang="ts">
	import { untrack } from 'svelte';
	import {
		Activity,
		ArrowRight,
		Database,
		HardDrive,
		Layers,
		Radio,
		Terminal,
		Workflow
	} from 'lucide-svelte';
	import {
		createPipelineStore,
		PIPELINE_ARROYO_LABEL,
		PIPELINE_CONSUMER_GROUP,
		PIPELINE_STREAM_SERVICE,
		PIPELINE_TOPIC,
		pipelineStore
	} from '$lib/stores/pipeline.svelte';
	import { session } from '$lib/stores/session.svelte';

	interface PipelinePerformanceScreenProps {
		store?: ReturnType<typeof createPipelineStore>;
		sessionStore?: typeof session;
	}

	let {
		store = pipelineStore,
		sessionStore = session
	}: PipelinePerformanceScreenProps = $props();

	const MAX_WINDOWED_LINES = 40;
	let windowStartOffset = $state<number | null>(null);
	let terminalEl = $state<HTMLDivElement | null>(null);

	const totalLines = $derived(store.terminalLines.length);
	const effectiveStart = $derived(
		windowStartOffset !== null
			? Math.max(0, Math.min(windowStartOffset, Math.max(0, totalLines - MAX_WINDOWED_LINES)))
			: Math.max(0, totalLines - MAX_WINDOWED_LINES)
	);
	const visibleLines = $derived(
		store.terminalLines.slice(effectiveStart, effectiveStart + MAX_WINDOWED_LINES)
	);

	$effect(() => {
		if (terminalEl && windowStartOffset === null && totalLines >= 0) {
			terminalEl.scrollTop = terminalEl.scrollHeight;
		}
	});

	$effect(() => {
		const currentStore = store;
		const token = sessionStore.token;
		untrack(() => {
			void currentStore.connectTelemetryStream({ token });
		});
		return () => {
			currentStore.disconnect();
		};
	});

	function handleTerminalScroll(event: Event) {
		const el = event.currentTarget as HTMLDivElement;
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 12;
		if (atBottom) {
			windowStartOffset = null;
			return;
		}
		const ratio =
			el.scrollHeight > el.clientHeight
				? el.scrollTop / (el.scrollHeight - el.clientHeight)
				: 1;
		const maxStart = Math.max(0, totalLines - MAX_WINDOWED_LINES);
		windowStartOffset = Math.round(ratio * maxStart);
	}

	function statusBadgeClasses(status: typeof store.status): string {
		if (status === 'live' || status === 'completed') {
			return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
		}
		if (status === 'connecting') {
			return 'border-amber-500/40 bg-amber-500/15 text-amber-300';
		}
		if (status === 'error') {
			return 'border-rose-500/40 bg-rose-500/15 text-rose-300';
		}
		return 'border-slate-700 bg-slate-800/80 text-slate-300';
	}
</script>

<section
	data-testid="screen-pipeline-performance"
	aria-label="Historical Data Injection Performance Studio"
	class="flex-1 bg-[#0B0F17] p-6 text-slate-100"
>
	<!-- Header -->
	<header class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-5">
		<div>
			<div class="flex items-center gap-2">
				<Workflow class="h-4 w-4 text-emerald-400" aria-hidden="true" />
				<span class="font-mono text-[11px] tracking-wider text-emerald-300 uppercase">
					Screen 6 · Historical Data Injection Performance Studio
				</span>
			</div>
			<h1 class="mt-1 text-xl font-semibold text-slate-50">
				Streaming Pipeline Telemetry &amp; Monotonic Invariants
			</h1>
			<p class="mt-1 text-xs text-slate-400">
				Read-only live telemetry for <span class="font-mono text-slate-300">{PIPELINE_STREAM_SERVICE}</span>
				· topic <span class="font-mono text-slate-300">{PIPELINE_TOPIC}</span>
				· <span class="font-mono text-slate-300">{PIPELINE_ARROYO_LABEL}</span>.
			</p>
		</div>

		<div class="flex items-center gap-2.5">
			<span
				data-testid="pipeline-readonly-badge"
				class="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-mono text-[11px] text-slate-300"
			>
				READ-ONLY TELEMETRY
			</span>
			<span
				data-testid="pipeline-status-pill"
				class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-medium uppercase {statusBadgeClasses(
					store.status
				)}"
			>
				<Activity class="h-3 w-3" aria-hidden="true" />
				{store.status}
			</span>
		</div>
	</header>

	{#if store.errorMessage}
		<div
			role="alert"
			data-testid="pipeline-error-banner"
			class="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 font-mono text-xs text-rose-200"
		>
			{store.errorMessage}
		</div>
	{/if}

	<!-- 4-Stage Topology Banner -->
	<div
		data-testid="pipeline-topology-banner"
		class="mt-5 rounded-xl border border-slate-800/80 bg-slate-900/70 p-4"
	>
		<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
			<span class="font-mono text-[11px] tracking-wider text-slate-400 uppercase">
				4-Stage Streaming Topology
			</span>
			<span class="font-mono text-[11px] text-emerald-300">
				Consumer Group {PIPELINE_CONSUMER_GROUP}: {store.consumerGroupLag} msgs lag
			</span>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-3">
			{#each store.stages as stage, index (stage.id)}
				<div
					data-testid="topology-stage-{stage.id}"
					class="flex min-w-[190px] flex-1 items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3.5 py-2.5"
				>
					<div>
						<p class="font-mono text-xs font-semibold text-slate-100">{stage.name}</p>
						<p class="font-mono text-[10px] text-slate-400">{stage.subtitle}</p>
					</div>
					<span
						data-testid="health-pill-{stage.id}"
						class="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300"
					>
						<span class="h-1.5 w-1.5 animate-pulse motion-reduce:animate-none rounded-full bg-emerald-400" aria-hidden="true"></span>
						{stage.healthPill}
					</span>
				</div>

				{#if index < store.stages.length - 1}
					<ArrowRight class="hidden h-4 w-4 shrink-0 text-slate-500 lg:block" aria-hidden="true" />
				{/if}
			{/each}
		</div>
	</div>

	<!-- Quad-Stage Metrics Cards with Monotonic Formula Math -->
	<div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
		<!-- Stage 1: stream-replay-rs -->
		<article
			data-testid="stage-card-stream-replay-rs"
			class="rounded-xl border border-slate-800/80 bg-slate-900/70 p-4"
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<Radio class="h-4 w-4 text-emerald-400" aria-hidden="true" />
					<h2 class="font-mono text-xs font-semibold text-slate-100">stream-replay-rs</h2>
				</div>
				<span class="font-mono text-[11px] text-emerald-300">{store.replayMsgsPerSec.toFixed(1)} msgs/s</span>
			</div>
			<p class="mt-3 font-mono text-2xl font-bold text-slate-50" data-testid="counter-events-emitted">
				{store.counters.eventsEmitted.toLocaleString()}
			</p>
			<p class="mt-1 font-mono text-[11px] text-slate-400">
				eventsEmitted · {PIPELINE_TOPIC}
			</p>
			<div class="mt-3 border-t border-slate-800/80 pt-2.5 font-mono text-[11px] text-slate-400">
				p50 {store.stages[0].latency.p50Ms}ms · p95 {store.stages[0].latency.p95Ms}ms · p99 {store.stages[0].latency.p99Ms}ms
			</div>
		</article>

		<!-- Stage 2: Apache Iggy -->
		<article
			data-testid="stage-card-apache-iggy"
			class="rounded-xl border border-slate-800/80 bg-slate-900/70 p-4"
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<HardDrive class="h-4 w-4 text-cyan-400" aria-hidden="true" />
					<h2 class="font-mono text-xs font-semibold text-slate-100">Apache Iggy</h2>
				</div>
				<span class="font-mono text-[11px] text-cyan-300">{store.iggyFsyncMs.toFixed(2)}ms fsync</span>
			</div>
			<p class="mt-3 font-mono text-2xl font-bold text-slate-50" data-testid="counter-iggy-offset">
				{store.counters.iggyOffset.toLocaleString()}
			</p>
			<p class="mt-1 font-mono text-[11px] text-slate-400">
				iggyOffset &le; eventsEmitted · committed {store.iggyCommitted.toLocaleString()}
			</p>
			<div class="mt-3 border-t border-slate-800/80 pt-2.5 font-mono text-[11px] text-slate-400">
				{PIPELINE_STREAM_SERVICE} · p50 {store.stages[1].latency.p50Ms}ms · p95 {store.stages[1].latency.p95Ms}ms · p99 {store.stages[1].latency.p99Ms}ms
			</div>
		</article>

		<!-- Stage 3: Arroyo -->
		<article
			data-testid="stage-card-arroyo"
			class="rounded-xl border border-slate-800/80 bg-slate-900/70 p-4"
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<Layers class="h-4 w-4 text-amber-400" aria-hidden="true" />
					<h2 class="font-mono text-xs font-semibold text-slate-100">Arroyo</h2>
				</div>
				<span class="font-mono text-[11px] text-amber-300">{store.arroyoWatermarkLagSec.toFixed(2)}s watermark lag</span>
			</div>
			<p class="mt-3 font-mono text-2xl font-bold text-slate-50" data-testid="counter-arroyo-processed">
				{store.counters.arroyoProcessed.toLocaleString()}
			</p>
			<p class="mt-1 font-mono text-[11px] text-slate-400" data-testid="consumer-group-lag">
				arroyoProcessed &le; iggyOffset · {PIPELINE_CONSUMER_GROUP}: {store.consumerGroupLag} msgs
			</p>
			<div class="mt-3 border-t border-slate-800/80 pt-2.5 font-mono text-[11px] text-slate-400">
				{PIPELINE_ARROYO_LABEL} · p50 {store.stages[2].latency.p50Ms}ms · p95 {store.stages[2].latency.p95Ms}ms · p99 {store.stages[2].latency.p99Ms}ms
			</div>
		</article>

		<!-- Stage 4: Delta Lake -->
		<article
			data-testid="stage-card-delta-lake"
			class="rounded-xl border border-slate-800/80 bg-slate-900/70 p-4"
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<Database class="h-4 w-4 text-emerald-400" aria-hidden="true" />
					<h2 class="font-mono text-xs font-semibold text-slate-100">Delta Lake</h2>
				</div>
				<span class="font-mono text-[11px] text-emerald-300">{store.deltaCommitLogMs.toFixed(1)}ms commit log</span>
			</div>
			<p class="mt-3 font-mono text-2xl font-bold text-slate-50" data-testid="counter-delta-rows">
				{store.counters.deltaRows.toLocaleString()}
			</p>
			<p class="mt-1 font-mono text-[11px] text-slate-400">
				deltaRows &le; arroyoProcessed
			</p>
			<div class="mt-3 border-t border-slate-800/80 pt-2.5 font-mono text-[11px] text-slate-400">
				p50 {store.stages[3].latency.p50Ms}ms · p95 {store.stages[3].latency.p95Ms}ms · p99 {store.stages[3].latency.p99Ms}ms
			</div>
		</article>
	</div>

	<!-- Delta Lake Table Partition Counts -->
	<div
		data-testid="delta-partitions-panel"
		class="mt-5 rounded-xl border border-slate-800/80 bg-slate-900/70 p-4"
	>
		<div class="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
			<span class="font-mono text-[11px] tracking-wider text-slate-400 uppercase">
				Delta Lake Table Partition Counts
			</span>
			<span class="font-mono text-[11px] text-slate-400">
				deltaRows &le; arroyoProcessed &le; iggyOffset &le; eventsEmitted
			</span>
		</div>
		<div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each store.deltaPartitions as item (item.table)}
				<div
					data-testid="partition-card-{item.table}"
					class="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 font-mono"
				>
					<p class="text-[11px] text-slate-400">{item.table}</p>
					<p class="mt-0.5 text-sm font-semibold text-slate-100">{item.partitions} partitions</p>
				</div>
			{/each}
		</div>
	</div>

	<!-- Virtualized/Windowed Pipeline SSE Terminal -->
	<div class="mt-5 rounded-xl border border-slate-800/80 bg-slate-950/90 p-4">
		<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
			<div class="flex items-center gap-2">
				<Terminal class="h-4 w-4 text-emerald-400" aria-hidden="true" />
				<span class="font-mono text-xs font-semibold text-slate-200">
					SSE Pipeline Telemetry Stream
				</span>
				<span class="font-mono text-[11px] text-slate-500">
					(windowed {visibleLines.length}/{totalLines} lines · throttleTime 16ms)
				</span>
			</div>
			<span class="font-mono text-[11px] text-slate-400">
				GET /api/v1/telemetry/pipeline/stream
			</span>
		</div>

		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			bind:this={terminalEl}
			data-testid="pipeline-terminal"
			role="region"
			aria-label="SSE Pipeline Telemetry Stream Output"
			aria-live="off"
			tabindex="0"
			onscroll={handleTerminalScroll}
			class="mt-3 h-52 overflow-y-auto rounded-lg border border-slate-800/80 bg-[#070A10] p-3 font-mono text-xs leading-relaxed"
		>
			{#if visibleLines.length === 0}
				{#if store.status === 'error'}
					<p class="text-rose-400">
						Telemetry stream error: {store.errorMessage ?? 'Connection failed'}
					</p>
				{:else if store.status === 'completed'}
					<p class="text-slate-500">
						Stream completed. No live events.
					</p>
				{:else if store.status === 'disconnected'}
					<p class="text-slate-500">
						Telemetry stream disconnected.
					</p>
				{:else}
					<p class="text-slate-500">
						Connecting to {PIPELINE_STREAM_SERVICE} SSE telemetry stream...
					</p>
				{/if}
			{:else}
				{#each visibleLines as line (line.id)}
					<div
						class="flex gap-2 py-0.5 {line.level === 'error'
							? 'text-rose-300'
							: line.level === 'checkpoint'
								? 'text-emerald-300'
								: line.level === 'metric'
									? 'text-cyan-200'
									: 'text-slate-300'}"
					>
						<span class="shrink-0 text-slate-500">{line.timestamp}</span>
						<span class="break-all">{line.text}</span>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</section>
