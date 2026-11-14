<script lang="ts">
	import HitlProposalCard from '$lib/components/HitlProposalCard.svelte';
	import ThoughtAccordion from '$lib/components/ThoughtAccordion.svelte';
	import {
		createInvestigationStore,
		formatBrl,
		investigationStore
	} from '$lib/stores/investigation.svelte';
	import { session } from '$lib/stores/session.svelte';

	interface InvestigationScreenProps {
		sessionStore?: typeof session;
		store?: ReturnType<typeof createInvestigationStore>;
		fetcher?: typeof fetch;
	}

	let {
		sessionStore = session,
		store = investigationStore,
		fetcher
	}: InvestigationScreenProps = $props();

	const activeOrder = $derived(store.activeOrder);
</script>

<div
	data-testid="screen-investigation"
	class="relative flex flex-1 flex-col divide-y divide-zinc-800 bg-[#09090b] text-zinc-100 lg:flex-row lg:divide-x lg:divide-y-0"
>
	<!-- Left Column: 240px Queues & Workspaces -->
	<aside
		data-testid="investigation-left-queue"
		aria-label="Queues and Workspaces"
		class="w-full shrink-0 bg-zinc-950/70 p-3.5 lg:w-[240px]"
	>
		<div class="flex items-center justify-between border-b border-zinc-800 pb-2.5">
			<h2 class="font-mono text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
				Queues &amp; Workspaces
			</h2>
			<span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
				{store.orders.length}
			</span>
		</div>

		<div class="mt-2.5 rounded-md border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-2">
			<p class="font-mono text-[10px] text-zinc-500 uppercase">Active Workspace</p>
			<p class="mt-0.5 text-xs font-medium text-zinc-200">
				SLA Recovery · {sessionStore.tenant ?? 'SP-01'}
			</p>
		</div>

		<ul class="mt-3 space-y-1.5" aria-label="Order queue">
			{#each store.orders as order (order.orderId)}
				{@const isSelected = activeOrder?.orderId === order.orderId}
				<li>
					<button
						type="button"
						data-testid="queue-order-{order.orderId}"
						aria-current={isSelected ? 'true' : undefined}
						onclick={() => store.selectOrder(order.orderId)}
						class="w-full rounded-lg border px-2.5 py-2 text-left transition {isSelected
							? 'border-amber-500/50 bg-zinc-900 text-zinc-50'
							: 'border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'}"
					>
						<div class="flex items-center justify-between gap-1">
							<span class="font-mono text-[11px] font-semibold text-zinc-200">
								{order.orderId}
							</span>
							<span
								class="h-1.5 w-1.5 rounded-full {order.slaStatus === 'BREACHED'
									? 'bg-red-400'
									: order.slaStatus === 'ON_TRACK'
										? 'bg-emerald-400'
										: 'bg-amber-400'}"
							></span>
						</div>
						<p class="mt-1 truncate text-xs text-zinc-300">{order.customerName}</p>
						<p class="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
							{order.slaBadgeText}
						</p>
					</button>
				</li>
			{:else}
				<li
					data-testid="investigation-empty-queue"
					class="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-center text-xs text-zinc-500"
				>
					No orders in queue.
				</li>
			{/each}
		</ul>
	</aside>

	<!-- Middle Column: flex-1 Investigation Canvas -->
	<section
		data-testid="investigation-middle-canvas"
		aria-label="Order Investigation Canvas"
		class="min-w-0 flex-1 overflow-y-auto p-5"
	>
		{#if activeOrder}
			<header class="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 pb-4">
				<div>
					<div class="flex flex-wrap items-center gap-2.5">
						<h1 class="font-mono text-lg font-semibold text-zinc-50">
							Order #{activeOrder.orderId}
						</h1>
						<span
							data-testid="sla-status-badge"
							class="rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold {activeOrder.slaStatus ===
							'BREACHED'
								? 'border-red-500/40 bg-red-500/15 text-red-300'
								: activeOrder.slaStatus === 'ON_TRACK'
									? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
									: 'border-amber-500/40 bg-amber-500/15 text-amber-300'}"
						>
							{activeOrder.slaBadgeText}
						</span>
					</div>
					<p class="mt-1 text-xs text-zinc-400">
						{activeOrder.carrier} · {activeOrder.route}
					</p>
				</div>

				<div
					data-testid="customer-ltv-card"
					class="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 text-right"
				>
					<p class="font-mono text-[10px] tracking-wider text-zinc-400 uppercase">Customer LTV</p>
					<p class="mt-0.5 font-mono text-base font-semibold text-emerald-300">
						{formatBrl(activeOrder.customerLtvBrl)}
					</p>
					<p class="text-[11px] text-zinc-400">
						{activeOrder.customerName} · {activeOrder.customerTier}
					</p>
				</div>
			</header>

			<!-- Itemized Goods -->
			<div class="mt-5">
				<h2 class="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
					Itemized Goods
				</h2>
				<div
					data-testid="itemized-goods-list"
					class="mt-2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50"
				>
					<table class="w-full text-left text-xs">
						<thead class="border-b border-zinc-800 bg-zinc-950/70 font-mono text-[10px] text-zinc-400 uppercase">
							<tr>
								<th scope="col" class="px-3 py-2">SKU</th>
								<th scope="col" class="px-3 py-2">Item</th>
								<th scope="col" class="px-3 py-2">Category</th>
								<th scope="col" class="px-3 py-2 text-right">Qty</th>
								<th scope="col" class="px-3 py-2 text-right">Unit Price</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-zinc-800/80">
							{#each activeOrder.items as item, index (`${item.sku}-${index}`)}
								<tr class="text-zinc-200">
									<td class="px-3 py-2.5 font-mono text-[11px] text-zinc-400">{item.sku}</td>
									<td class="px-3 py-2.5 font-medium text-zinc-100">{item.name}</td>
									<td class="px-3 py-2.5 text-zinc-400">{item.category}</td>
									<td class="px-3 py-2.5 text-right font-mono">{item.quantity}</td>
									<td class="px-3 py-2.5 text-right font-mono text-zinc-200">
										{formatBrl(item.unitPriceBrl)}
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="5" class="px-3 py-4 text-center text-xs text-zinc-500">
										No itemized goods recorded.
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Customer Review with 1-Click Translation Toggle -->
			<div class="mt-5">
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<h2 class="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
							Customer Review
						</h2>
						<span
							aria-label={`Customer rating ${activeOrder.reviewRating} out of 5 stars, ${store.showTranslation ? 'English translation' : 'Original Portuguese'}`}
							class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300"
						>
							{activeOrder.reviewRating}/5 <span aria-hidden="true">★</span> · {store.showTranslation
								? 'EN'
								: 'PT-BR'}
						</span>
					</div>

					<button
						type="button"
						data-testid="translation-toggle-btn"
						aria-pressed={store.showTranslation}
						onclick={() => store.toggleTranslation()}
						class="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
					>
						{store.showTranslation ? 'Show Original (PT-BR)' : 'Translate to English'}
					</button>
				</div>

				<blockquote
					data-testid="customer-review-text"
					class="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3.5 text-sm leading-relaxed text-zinc-200"
				>
					{store.showTranslation ? activeOrder.reviewTranslatedEn : activeOrder.reviewOriginalPt}
				</blockquote>
			</div>
		{:else}
			<div
				data-testid="investigation-empty-canvas"
				class="flex h-full flex-col items-center justify-center py-16 text-center"
			>
				<h1 class="font-mono text-lg font-semibold text-zinc-200">No active order selected</h1>
				<p class="mt-1 text-xs text-zinc-500">
					Select an order from the queue to inspect SLA telemetry and copilot proposals.
				</p>
			</div>
		{/if}
	</section>

	<!-- Right Column: 420px CX Copilot Sidecar -->
	<aside
		data-testid="investigation-right-copilot"
		aria-label="CX Copilot Sidecar"
		class="flex w-full shrink-0 flex-col gap-3.5 bg-zinc-950/70 p-4 lg:w-[420px]"
	>
		<div class="flex items-center justify-between border-b border-zinc-800 pb-2.5">
			<div class="flex items-center gap-2">
				<span class="inline-flex h-2 w-2 rounded-full bg-purple-400"></span>
				<h2 class="font-mono text-xs font-semibold tracking-wider text-zinc-200 uppercase">
					CX Copilot Sidecar
				</h2>
			</div>
			<span class="font-mono text-[10px] text-zinc-500">Sandboxed HITL</span>
		</div>

		{#if activeOrder}
			<div class="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs leading-relaxed text-zinc-300">
				{activeOrder.copilotSummary}
			</div>

			<ThoughtAccordion thoughts={activeOrder.thoughts} toolCalls={activeOrder.toolCalls} />

			<HitlProposalCard
				proposal={activeOrder.proposal}
				status={store.proposalStatus}
				errorMessage={store.proposalError}
				onApprove={() => store.approveProposal(sessionStore.token, fetcher)}
				onDismiss={() => store.dismissProposal()}
			/>
		{:else}
			<div
				data-testid="investigation-empty-copilot"
				class="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500"
			>
				Select an order to view copilot reasoning and HITL actions.
			</div>
		{/if}
	</aside>

	<!-- Amber Toast Confirmation -->
	{#if store.toast}
		<div
			role="status"
			aria-live="polite"
			data-testid="amber-toast"
			class="fixed right-5 bottom-5 z-50 flex max-w-md items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-950/95 px-4 py-3 text-amber-100 shadow-2xl"
		>
			<span class="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-400"></span>
			<div class="min-w-0 flex-1">
				<p class="text-xs font-semibold text-amber-200">{store.toast.title}</p>
				<p class="mt-0.5 text-[11px] text-amber-100/80">{store.toast.detail}</p>
			</div>
			<button
				type="button"
				data-testid="toast-dismiss-btn"
				aria-label="Dismiss notification"
				onclick={() => store.dismissToast()}
				class="rounded px-1.5 py-0.5 text-xs text-amber-300 hover:bg-amber-900/60"
			>
				✕
			</button>
		</div>
	{/if}
</div>
