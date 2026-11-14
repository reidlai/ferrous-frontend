<script lang="ts">
	import {
		Activity,
		CheckCircle2,
		Cpu,
		Database,
		Play,
		ShieldAlert,
		Square,
		Terminal,
		Zap
	} from 'lucide-svelte';
	import {
		benchmarksStore,
		createBenchmarksStore,
		DELTA_LLM_BENCHMARKS_SOURCE,
		type TtftTier
	} from '$lib/stores/benchmarks.svelte';
	import { session } from '$lib/stores/session.svelte';

	interface BenchmarksScreenProps {
		store?: ReturnType<typeof createBenchmarksStore>;
		sessionStore?: typeof session;
	}

	let {
		store = benchmarksStore,
		sessionStore = session
	}: BenchmarksScreenProps = $props();

	const MAX_WINDOWED_LINES = 40;
	let windowStartOffset = $state<number | null>(null);

	const totalLines = $derived(store.terminalLines.length);
	const effectiveStart = $derived(
		windowStartOffset !== null
			? Math.max(0, Math.min(windowStartOffset, Math.max(0, totalLines - MAX_WINDOWED_LINES)))
			: Math.max(0, totalLines - MAX_WINDOWED_LINES)
	);
	const visibleLines = $derived(
		store.terminalLines.slice(effectiveStart, effectiveStart + MAX_WINDOWED_LINES)
	);

	function handleTerminalScroll(event: Event) {
		const el = event.currentTarget as HTMLDivElement;
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 12;
		if (atBottom) {
			windowStartOffset = null;
			return;
		}
		const ratio = el.scrollHeight > el.clientHeight
			? el.scrollTop / (el.scrollHeight - el.clientHeight)
			: 1;
		const maxStart = Math.max(0, totalLines - MAX_WINDOWED_LINES);
		windowStartOffset = Math.round(ratio * maxStart);
	}

	function tierBadgeClasses(tier: TtftTier): string {
		if (tier === 'emerald') {
			return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
		}
		if (tier === 'amber') {
			return 'border-amber-500/40 bg-amber-500/15 text-amber-300';
		}
		return 'border-rose-500/40 bg-rose-500/15 text-rose-300';
	}

	function statusPillClasses(status: typeof store.status): string {
		if (status === 'running') {
			return 'border-amber-500/40 bg-amber-500/15 text-amber-300';
		}
		if (status === 'completed') {
			return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
		}
		if (status === 'aborted' || status === 'error') {
			return 'border-rose-500/40 bg-rose-500/15 text-rose-300';
		}
		return 'border-slate-700 bg-slate-800/80 text-slate-300';
	}

	function handleRunSuite() {
		windowStartOffset = null;
		void store.runBenchmarkSuite({ token: sessionStore.token });
	}

	function handleAbortSuite() {
		store.abortRun();
	}

	function handleRunSql() {
		store.executeSqlQuery();
	}

	$effect(() => () => {
		if (store.status === 'running') {
			store.abortRun();
		}
	});
</script>

<section
	data-testid="screen-benchmarks"
	aria-label="Copilot & Agent Benchmarking Studio"
	class="flex-1 bg-[#0B0F17] p-6 text-slate-100"
>
	<!-- Header & Primary CTA -->
	<header class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-5">
		<div>
			<div class="flex items-center gap-2">
				<Cpu class="h-4 w-4 text-amber-400" aria-hidden="true" />
				<span class="font-mono text-[11px] tracking-wider text-amber-300 uppercase">
					Screen 5 · Copilot &amp; Agent Benchmarking Studio
				</span>
			</div>
			<h1 class="mt-1 text-xl font-semibold text-slate-50">
				LLM Latency, Tool-Calling &amp; DataFusion Telemetry
			</h1>
			<p class="mt-1 text-xs text-slate-400">
				Compare microsecond TTFT, strict JSON Schema tool validation, and DataFusion SQL metrics across
				<span class="font-mono text-slate-300">{DELTA_LLM_BENCHMARKS_SOURCE}</span>.
			</p>
		</div>

		<div class="flex items-center gap-2.5">
			{#if store.status === 'running'}
				<button
					type="button"
					data-testid="abort-benchmark-btn"
					onclick={handleAbortSuite}
					class="inline-flex items-center gap-2 rounded-lg border border-rose-500/50 bg-rose-500/15 px-3.5 py-2 font-mono text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25"
				>
					<Square class="h-3.5 w-3.5" aria-hidden="true" />
					Abort Run
				</button>
			{/if}

			<button
				type="button"
				data-testid="run-benchmark-btn"
				onclick={handleRunSuite}
				class="inline-flex items-center gap-2 rounded-lg border border-amber-400/60 bg-amber-500 px-4 py-2 font-mono text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400"
			>
				<Play class="h-3.5 w-3.5" aria-hidden="true" />
				{store.status === 'running' ? 'Re-run Benchmark Suite' : 'Run Benchmark Suite'}
			</button>
		</div>
	</header>

	<!-- Model Selection Pills & Category Tabs -->
	<div class="mt-5 flex flex-col gap-4 rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Target LLM Models">
				<span class="mr-1 font-mono text-[11px] text-slate-400 uppercase">Models:</span>
				{#each store.models as model (model.id)}
					{@const isSelected = store.selectedModelIds.includes(model.id)}
					<button
						type="button"
						data-testid="model-pill-{model.id}"
						aria-pressed={isSelected}
						aria-disabled={isSelected && store.selectedModelIds.length <= 1}
						onclick={() => store.toggleModel(model.id)}
						class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs transition {isSelected
							? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
							: 'border-slate-700/80 bg-slate-950/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'}"
					>
						<span class="font-semibold">{model.name}</span>
						<span class="text-[10px] opacity-75">({model.id})</span>
					</button>
				{/each}
			</div>

			<span class="font-mono text-[11px] text-slate-400">
				{store.selectedModelIds.length} active · {store.filteredPrompts.length} prompt(s)
			</span>
		</div>

		<div class="flex flex-wrap items-center gap-1.5 border-t border-slate-800/80 pt-3" role="group" aria-label="Benchmark categories">
			{#each store.categories as tab (tab.id)}
				{@const isActive = store.activeCategory === tab.id}
				<button
					type="button"
					data-testid="category-tab-{tab.id}"
					aria-pressed={isActive}
					onclick={() => store.setCategory(tab.id)}
					class="rounded-md px-3 py-1.5 font-mono text-xs transition {isActive
						? 'bg-slate-800 font-semibold text-amber-300 ring-1 ring-amber-500/40'
						: 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Microsecond TTFT Telemetry HUD & Tool-Calling Validation -->
	<div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
		<div
			data-testid="ttft-hud"
			class="rounded-xl border border-slate-800/80 bg-slate-900/70 p-4 lg:col-span-2"
		>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<Zap class="h-4 w-4 text-amber-400" aria-hidden="true" />
					<span class="font-mono text-[11px] tracking-wider text-slate-400 uppercase">
						Microsecond TTFT Telemetry HUD
					</span>
				</div>

				<span
					data-testid="ttft-tier-badge"
					class="rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold {tierBadgeClasses(
						store.ttftClassification.tier
					)}"
				>
					{store.ttftClassification.label}
				</span>
			</div>

			<div class="mt-3 flex flex-wrap items-baseline justify-between gap-3">
				<p class="font-mono text-2xl font-bold text-slate-50" data-testid="ttft-formatted-value">
					{store.formattedTtft}
				</p>
				<div class="flex items-center gap-3 font-mono text-[11px] text-slate-400">
					<span class="text-emerald-300">&lt;200ms FAST</span>
					<span class="text-amber-300">200–500ms NOMINAL</span>
					<span class="text-rose-300">&gt;500ms SLOW</span>
				</div>
			</div>
		</div>

		<div class="rounded-xl border border-slate-800/80 bg-slate-900/70 p-4">
			<div class="flex items-center justify-between gap-2">
				<span class="font-mono text-[11px] tracking-wider text-slate-400 uppercase">
					Tool Schema Validation
				</span>
				<span
					data-testid="tool-validation-badge"
					class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold {store.toolValidation.status === 'PASS'
						? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
						: 'border-rose-500/40 bg-rose-500/15 text-rose-300'}"
				>
					{#if store.toolValidation.status === 'PASS'}
						<CheckCircle2 class="h-3 w-3" aria-hidden="true" />
					{:else}
						<ShieldAlert class="h-3 w-3" aria-hidden="true" />
					{/if}
					{store.toolValidation.status}
				</span>
			</div>

			<p class="mt-3 font-mono text-sm font-semibold text-slate-100">
				{store.toolValidation.toolName}
			</p>
			<p class="mt-1 text-xs text-slate-400">
				{store.toolValidation.message} ({store.toolValidation.schemaVersion})
			</p>
		</div>
	</div>

	<!-- Virtualized/Windowed 60fps SSE Streaming Terminal -->
	<div class="mt-5 rounded-xl border border-slate-800/80 bg-slate-950/90 p-4">
		<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
			<div class="flex items-center gap-2">
				<Terminal class="h-4 w-4 text-amber-400" aria-hidden="true" />
				<span class="font-mono text-xs font-semibold text-slate-200">
					SSE Benchmark Stream
				</span>
				<span class="font-mono text-[11px] text-slate-500">
					(windowed {visibleLines.length}/{totalLines} lines · throttleTime 16ms)
				</span>
			</div>

			<span
				data-testid="benchmark-status-pill"
				class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase {statusPillClasses(
					store.status
				)}"
			>
				<Activity class="h-3 w-3" aria-hidden="true" />
				{store.status}
			</span>
		</div>

		<div
			data-testid="benchmark-terminal"
			role="log"
			aria-live="polite"
			aria-label="SSE Benchmark Stream Output"
			tabindex="0"
			onscroll={handleTerminalScroll}
			class="mt-3 h-52 overflow-y-auto rounded-lg border border-slate-800/80 bg-[#070A10] p-3 font-mono text-xs leading-relaxed"
		>
			{#if visibleLines.length === 0}
				<p class="text-slate-500">
					Ready. Select models and click [Run Benchmark Suite] to stream SSE telemetry...
				</p>
			{:else}
				{#each visibleLines as line (line.id)}
					<div
						class="flex gap-2 py-0.5 {line.level === 'error'
							? 'text-rose-300'
							: line.level === 'done'
								? 'text-emerald-300'
								: line.level === 'ttft'
									? 'text-amber-200'
									: line.level === 'tool'
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

	<!-- DataFusion SQL Comparative Query Panel -->
	<div
		data-testid="datafusion-sql-panel"
		class="mt-5 rounded-xl border border-slate-800/80 bg-slate-900/70 p-4"
	>
		<div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
			<div class="flex items-center gap-2">
				<Database class="h-4 w-4 text-emerald-400" aria-hidden="true" />
				<div>
					<h2 class="text-sm font-semibold text-slate-100">
						DataFusion SQL Comparative Query
					</h2>
					<p class="font-mono text-[11px] text-slate-400">
						Source: {DELTA_LLM_BENCHMARKS_SOURCE}
					</p>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<span
					data-testid="datafusion-latency-badge"
					class="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300"
				>
					{store.sqlResult.executionMs.toFixed(1)}ms DataFusion
				</span>
				<button
					type="button"
					data-testid="datafusion-run-btn"
					onclick={handleRunSql}
					class="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 font-mono text-xs font-medium text-slate-100 transition hover:border-amber-500/50 hover:text-amber-200"
				>
					Run SQL
				</button>
			</div>
		</div>

		<textarea
			data-testid="datafusion-sql-input"
			aria-label="DataFusion SQL Query"
			aria-invalid={Boolean(store.sqlResult.error)}
			aria-describedby={store.sqlResult.error ? 'datafusion-sql-error' : undefined}
			rows="3"
			value={store.sqlQuery}
			oninput={(e) => store.setSqlQuery((e.currentTarget as HTMLTextAreaElement).value)}
			class="mt-3 w-full rounded-lg border border-slate-800 bg-[#070A10] p-3 font-mono text-xs text-slate-200 focus:border-amber-500/60 focus:outline-none"
		></textarea>

		{#if store.sqlResult.error}
			<p id="datafusion-sql-error" class="mt-2 font-mono text-xs text-rose-300" role="alert">
				{store.sqlResult.error}
			</p>
		{:else}
			<div class="mt-3 overflow-x-auto rounded-lg border border-slate-800">
				<table
					data-testid="datafusion-results-table"
					aria-label="DataFusion SQL Results"
					class="w-full border-collapse text-left font-mono text-xs"
				>
					<thead class="bg-slate-950/80 text-[11px] text-slate-400 uppercase">
						<tr>
							{#each store.sqlResult.columns as col (col)}
								<th scope="col" class="border-b border-slate-800 px-3 py-2">{col}</th>
							{/each}
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-800/70">
						{#if store.sqlResult.rows.length === 0}
							<tr>
								<td
									colspan={store.sqlResult.columns.length}
									class="px-3 py-4 text-center text-slate-400"
								>
									No benchmark rows matched query.
								</td>
							</tr>
						{:else}
							{#each store.sqlResult.rows as row, i (i)}
								<tr class="hover:bg-slate-800/40">
									{#each store.sqlResult.columns as col (col)}
										<td class="px-3 py-2 text-slate-200">{row[col]}</td>
									{/each}
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</section>
