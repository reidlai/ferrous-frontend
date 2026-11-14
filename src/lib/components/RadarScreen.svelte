<script lang="ts">
	import { AlertTriangle, ArrowUpRight, Radio, Search, ShieldAlert } from 'lucide-svelte';
	import {
		createInvestigationStore,
		investigationStore
	} from '$lib/stores/investigation.svelte';
	import {
		createRadarStore,
		radarStore,
		type BreachSeverity,
		type UfFilter
	} from '$lib/stores/radar.svelte';
	import { createWorkspaceStore, workspace } from '$lib/stores/workspace.svelte';

	interface RadarScreenProps {
		store?: ReturnType<typeof createRadarStore>;
		invStore?: ReturnType<typeof createInvestigationStore>;
		workspaceStore?: ReturnType<typeof createWorkspaceStore>;
	}

	let {
		store = radarStore,
		invStore = investigationStore,
		workspaceStore = workspace
	}: RadarScreenProps = $props();

	const UF_PILLS: ReadonlyArray<{ label: string; value: UfFilter }> = [
		{ label: 'All', value: 'ALL' },
		{ label: 'SP', value: 'SP' },
		{ label: 'RJ', value: 'RJ' },
		{ label: 'MG', value: 'MG' }
	];

	function severityBadgeClasses(severity: BreachSeverity): string {
		if (severity === 'CRITICAL') {
			return 'border-rose-500/40 bg-rose-500/15 text-rose-300';
		}
		if (severity === 'HIGH') {
			return 'border-amber-500/40 bg-amber-500/15 text-amber-300';
		}
		return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
	}

	function handleCarrierChange(event: Event): void {
		const target = event.currentTarget as HTMLSelectElement;
		store.setCarrierFilter(target.value);
	}

	function handleSearchInput(event: Event): void {
		const target = event.currentTarget as HTMLInputElement;
		store.setSearchQuery(target.value);
	}
</script>

<section
	data-testid="screen-radar"
	aria-label="Live Ops Radar"
	class="flex-1 bg-[#0B0F17] p-6 text-slate-100"
>
	<!-- Header & 418 Active Breaches KPI -->
	<header
		class="flex flex-col gap-4 border-b border-slate-800/80 pb-5 lg:flex-row lg:items-center lg:justify-between"
	>
		<div>
			<div class="flex items-center gap-2">
				<Radio class="h-4 w-4 text-rose-400" aria-hidden="true" />
				<span class="font-mono text-[11px] tracking-wider text-rose-300 uppercase">
					Screen 2 · Live Ops Radar
				</span>
			</div>
			<h1 class="mt-1 text-xl font-semibold text-slate-50">SLA Breach Radar</h1>
			<p class="mt-1 text-xs text-slate-400">
				Real-time Olist shipment SLA exceptions across Brazilian carrier hubs.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<div
				data-testid="radar-total-breaches"
				class="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-slate-900/70 px-4 py-2.5"
			>
				<AlertTriangle class="h-5 w-5 text-rose-400" aria-hidden="true" />
				<div>
					<p class="font-mono text-[10px] tracking-wider text-slate-400 uppercase">
						Active SLA Breaches
					</p>
					<div class="flex items-baseline gap-2">
						<span class="font-mono text-2xl font-bold text-rose-300">
							{store.totalBreaches}
						</span>
						<span
							data-testid="radar-filtered-count"
							class="font-mono text-xs text-slate-400"
						>
							({store.filteredBreaches.length} shown)
						</span>
					</div>
				</div>
			</div>
		</div>
	</header>

	<!-- Filter Bar: UF pills, Carrier select, Search input -->
	<div
		class="mt-5 flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-900/70 p-4 lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by state UF">
			<span class="mr-1 font-mono text-[11px] text-slate-400 uppercase">UF:</span>
			{#each UF_PILLS as pill (pill.value)}
				{@const isActive = store.ufFilter === pill.value}
				<button
					type="button"
					data-testid="radar-uf-pill-{pill.value}"
					aria-pressed={isActive}
					onclick={() => store.setUfFilter(pill.value)}
					class="rounded-lg border px-3 py-1.5 font-mono text-xs font-medium transition {isActive
						? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
						: 'border-slate-700/80 bg-slate-950/60 text-slate-300 hover:border-slate-600 hover:text-slate-100'}"
				>
					{pill.label}
				</button>
			{/each}
		</div>

		<div class="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
			<label class="flex items-center gap-2 text-xs text-slate-300">
				<span class="font-mono text-[11px] text-slate-400 uppercase">Carrier</span>
				<select
					data-testid="radar-carrier-select"
					aria-label="Filter by carrier"
					value={store.carrierFilter}
					onchange={handleCarrierChange}
					class="rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-1.5 font-mono text-xs text-slate-200 focus:border-amber-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
				>
					<option value="ALL">All Carriers</option>
					{#each store.carrierOptions as carrier (carrier)}
						<option value={carrier}>{carrier}</option>
					{/each}
				</select>
			</label>

			<div class="relative min-w-[220px]">
				<Search
					class="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
					aria-hidden="true"
				/>
				<input
					type="search"
					data-testid="radar-search-input"
					aria-label="Search SLA breaches"
					placeholder="Search order, customer, hub..."
					value={store.searchQuery}
					oninput={handleSearchInput}
					class="w-full rounded-lg border border-slate-700/80 bg-slate-950/80 py-1.5 pr-3 pl-8 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
				/>
			</div>
		</div>
	</div>

	<!-- Breach Table -->
	<div class="mt-5 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/70">
		<div class="overflow-x-auto">
			<table aria-label="SLA Breaches" class="w-full border-collapse text-left text-xs">
				<thead class="border-b border-slate-800 bg-slate-950/70 font-mono text-[11px] text-slate-400 uppercase">
					<tr>
						<th scope="col" class="px-4 py-3">Order ID</th>
						<th scope="col" class="px-4 py-3">Customer</th>
						<th scope="col" class="px-4 py-3">Carrier &amp; Hub</th>
						<th scope="col" class="px-4 py-3">UF</th>
						<th scope="col" class="px-4 py-3">Delay</th>
						<th scope="col" class="px-4 py-3">Risk / Severity</th>
						<th scope="col" class="px-4 py-3 text-right">Action</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800/70">
					{#each store.filteredBreaches as breach (breach.orderId)}
						<tr
							data-testid="radar-row-{breach.orderId}"
							class="transition hover:bg-slate-800/40"
						>
							<td class="px-4 py-3 font-mono font-semibold text-slate-100">
								{breach.orderId}
							</td>
							<td class="px-4 py-3 text-slate-200">{breach.customerName}</td>
							<td class="px-4 py-3">
								<div class="font-medium text-slate-200">{breach.carrier}</div>
								<div class="font-mono text-[10px] text-slate-400">{breach.hub}</div>
							</td>
							<td class="px-4 py-3">
								<span
									class="rounded border border-slate-700 bg-slate-950/70 px-2 py-0.5 font-mono text-[11px] text-slate-300"
								>
									{breach.uf}
								</span>
							</td>
							<td class="px-4 py-3 font-mono font-semibold text-rose-300">
								+{breach.delayDays.toFixed(1)}d
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<span
										class="rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold {severityBadgeClasses(breach.severity)}"
									>
										{breach.severity}
									</span>
									<span class="font-mono text-[11px] text-slate-400">
										{breach.riskScore}/100
									</span>
								</div>
							</td>
							<td class="px-4 py-3 text-right">
								<button
									type="button"
									data-testid="investigate-btn-{breach.orderId}"
									onclick={() =>
										store.selectBreachAndInvestigate(
											breach.orderId,
											invStore,
											workspaceStore
										)}
									class="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 font-mono text-[11px] font-semibold text-amber-200 transition hover:border-amber-400/70 hover:bg-amber-500/25"
								>
									<span>Investigate</span>
									<ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
								</button>
							</td>
						</tr>
					{:else}
						<tr data-testid="radar-empty-state">
							<td colspan="7" class="px-6 py-12 text-center">
								<div class="mx-auto flex max-w-md flex-col items-center gap-2">
									<ShieldAlert class="h-7 w-7 text-slate-500" aria-hidden="true" />
									{#if store.breaches.length === 0}
										<p class="text-sm font-medium text-slate-200">
											No active SLA breaches in queue
										</p>
										<p class="text-xs text-slate-400">
											All monitored shipments are currently within their promised delivery windows.
										</p>
									{:else}
										<p class="text-sm font-medium text-slate-200">
											No SLA breaches match the active filters
										</p>
										<p class="text-xs text-slate-400">
											Adjust the UF state pill, carrier filter, or search query to inspect queued exceptions.
										</p>
										<button
											type="button"
											data-testid="radar-clear-filters-btn"
											onclick={() => store.clearFilters()}
											class="mt-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200 hover:border-amber-500/50 hover:text-amber-200"
										>
											Reset filters
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>
