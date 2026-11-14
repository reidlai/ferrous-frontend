<script lang="ts">
	import { BarChart3, MapPin, TrendingDown, TrendingUp, Truck } from 'lucide-svelte';
	import {
		CARRIER_BENCHMARKS,
		createRadarStore,
		radarStore,
		REGIONAL_CLUSTERS,
		type BreachSeverity
	} from '$lib/stores/radar.svelte';

	interface AnalyticsScreenProps {
		store?: ReturnType<typeof createRadarStore>;
	}

	let { store = radarStore }: AnalyticsScreenProps = $props();

	function severityPill(severity: BreachSeverity): string {
		if (severity === 'CRITICAL') {
			return 'border-rose-500/40 bg-rose-500/15 text-rose-300';
		}
		if (severity === 'HIGH') {
			return 'border-amber-500/40 bg-amber-500/15 text-amber-300';
		}
		return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
	}

	function clampPct(value: number): number {
		if (!Number.isFinite(value)) return 0;
		return Math.max(0, Math.min(100, value));
	}
</script>

<section
	data-testid="screen-analytics"
	aria-label="SLA & Analytics"
	class="flex-1 bg-[#0B0F17] p-6 text-slate-100"
>
	<header class="border-b border-slate-800/80 pb-5">
		<div class="flex items-center gap-2">
			<BarChart3 class="h-4 w-4 text-amber-400" aria-hidden="true" />
			<span class="font-mono text-[11px] tracking-wider text-amber-300 uppercase">
				Screen 3 · SLA &amp; Carrier Analytics
			</span>
		</div>
		<h1 class="mt-1 text-xl font-semibold text-slate-50">Carrier Benchmarks &amp; Regional Clusters</h1>
		<p class="mt-1 text-xs text-slate-400">
			Comparative SLA compliance for Correios SEDEX vs DirectLog and regional delay clusters across Brazil.
		</p>
	</header>

	<!-- Carrier Comparison Cards -->
	<div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
		{#each CARRIER_BENCHMARKS as carrier (carrier.id)}
			<article
				data-testid="carrier-card-{carrier.id}"
				class="rounded-xl border border-slate-800/80 bg-slate-900/70 p-5"
			>
				<div class="flex items-start justify-between gap-3">
					<div class="flex items-center gap-2.5">
						<div
							class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-950/70"
						>
							<Truck class="h-4 w-4 text-amber-300" aria-hidden="true" />
						</div>
						<div>
							<h2 class="text-base font-semibold text-slate-50">{carrier.name}</h2>
							<p class="font-mono text-[11px] text-slate-400">
								Active breaches: {carrier.activeBreaches}
							</p>
						</div>
					</div>

					<span
						class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium {carrier.trendDirection === 'up'
							? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
							: 'border-rose-500/40 bg-rose-500/15 text-rose-300'}"
					>
						{#if carrier.trendDirection === 'up'}
							<TrendingUp class="h-3.5 w-3.5" aria-hidden="true" />
						{:else}
							<TrendingDown class="h-3.5 w-3.5" aria-hidden="true" />
						{/if}
						{carrier.trendLabel}
					</span>
				</div>

				<div class="mt-5 grid grid-cols-3 gap-3">
					<div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
						<p class="font-mono text-[10px] text-slate-400 uppercase">SLA Compliance</p>
						<p class="mt-1 font-mono text-lg font-bold text-slate-100">
							{carrier.slaCompliancePct.toFixed(1)}%
						</p>
					</div>
					<div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
						<p class="font-mono text-[10px] text-slate-400 uppercase">Avg Delay</p>
						<p class="mt-1 font-mono text-lg font-bold text-amber-300">
							+{carrier.avgDelayDays.toFixed(1)}d
						</p>
					</div>
					<div class="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
						<p class="font-mono text-[10px] text-slate-400 uppercase">P95 Transit</p>
						<p class="mt-1 font-mono text-lg font-bold text-slate-100">
							{carrier.p95TransitDays.toFixed(1)}d
						</p>
					</div>
				</div>

				<!-- Proportional SLA bar -->
				<div class="mt-4">
					<div class="mb-1 flex justify-between font-mono text-[10px] text-slate-400">
						<span>On-time SLA Attainment</span>
						<span>{carrier.slaCompliancePct.toFixed(1)}%</span>
					</div>
					<div class="h-2 w-full overflow-hidden rounded-full bg-slate-950" aria-hidden="true">
						<div
							class="h-full rounded-full {carrier.accent === 'emerald'
								? 'bg-emerald-400'
								: carrier.accent === 'amber'
									? 'bg-amber-400'
									: 'bg-rose-400'}"
							style="width: {clampPct(carrier.slaCompliancePct)}%"
						></div>
					</div>
				</div>
			</article>
		{/each}
	</div>

	<!-- Regional Delay Clusters -->
	<section
		data-testid="regional-delay-clusters"
		aria-label="Regional Delay Clusters"
		class="mt-6 rounded-xl border border-slate-800/80 bg-slate-900/70 p-5"
	>
		<div class="flex flex-col gap-2 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<div class="flex items-center gap-2">
					<MapPin class="h-4 w-4 text-amber-400" aria-hidden="true" />
					<h2 class="text-base font-semibold text-slate-50">Regional Delay Clusters</h2>
				</div>
				<p class="mt-1 text-xs text-slate-400">
					Select a Brazilian UF cluster to inspect bottleneck hub concentration and average delay.
				</p>
			</div>

			<div
				data-testid="selected-cluster-summary"
				class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-mono text-xs text-amber-200"
			>
				Focused UF: {store.selectedCluster.uf} ({store.selectedCluster.stateName}) · {store.selectedCluster.topBottleneck}
			</div>
		</div>

		<div class="mt-4 space-y-3">
			{#each REGIONAL_CLUSTERS as cluster (cluster.uf)}
				{@const isSelected = store.selectedClusterUf === cluster.uf}
				<button
					type="button"
					data-testid="cluster-row-{cluster.uf}"
					aria-pressed={isSelected}
					onclick={() => store.selectCluster(cluster.uf)}
					class="w-full rounded-xl border p-3.5 text-left transition {isSelected
						? 'border-amber-500/60 bg-slate-800/60'
						: 'border-slate-800/80 bg-slate-950/60 hover:border-slate-700'}"
				>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div class="flex items-center gap-2.5">
							<span
								class="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-slate-100"
							>
								{cluster.uf}
							</span>
							<span class="text-sm font-medium text-slate-100">{cluster.stateName}</span>
							<span
								class="rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold {severityPill(cluster.severity)}"
							>
								{cluster.severity}
							</span>
						</div>

						<div class="flex items-center gap-4 font-mono text-xs">
							<span class="text-slate-300">{cluster.activeBreaches} breaches</span>
							<span class="text-amber-300">+{cluster.avgDelayDays.toFixed(1)}d avg</span>
							<span class="text-slate-400">{cluster.sharePct.toFixed(1)}%</span>
						</div>
					</div>

					<div class="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-900" aria-hidden="true">
						<div
							class="h-full rounded-full transition-all {isSelected
								? 'bg-amber-400'
								: 'bg-rose-400/80'}"
							style="width: {clampPct(cluster.sharePct)}%"
						></div>
					</div>

					<p class="mt-2 font-mono text-[11px] text-slate-400">
						Bottleneck: {cluster.topBottleneck}
					</p>
				</button>
			{/each}
		</div>
	</section>
</section>
