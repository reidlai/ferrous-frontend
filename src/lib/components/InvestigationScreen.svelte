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

	function formatShortDate(iso?: string | null): string {
		if (!iso) return 'Pending';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
	}
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
			<div class="flex items-center gap-1.5">
				<span
					data-testid="orders-source-badge"
					class="rounded px-1.5 py-0.5 font-mono text-[10px] {store.dataSource === 'tidb'
						? 'bg-emerald-500/20 text-emerald-300'
						: 'bg-zinc-800 text-zinc-400'}"
				>
					{store.dataSource === 'tidb' ? 'TiDB' : 'Seed'}
				</span>
				<span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
					{store.orders.length}
				</span>
			</div>
		</div>

		<div class="mt-2.5 flex items-center justify-between gap-2 rounded-md border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-2">
			<div class="min-w-0">
				<p class="font-mono text-[10px] text-zinc-500 uppercase">Active Workspace</p>
				<p class="mt-0.5 truncate text-xs font-medium text-zinc-200">
					SLA Recovery · {sessionStore.tenant ?? 'SP-01'}
				</p>
			</div>
			<button
				type="button"
				data-testid="sync-live-orders-btn"
				disabled={store.isSyncing}
				onclick={() => store.loadLiveOrders(sessionStore.token, fetcher)}
				class="shrink-0 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-[10px] text-zinc-300 transition hover:border-amber-500/50 hover:text-amber-200 disabled:opacity-50"
			>
				{store.isSyncing ? 'Syncing…' : 'Sync TiDB'}
			</button>
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
						{#if activeOrder.orderStatus}
							· <span class="font-mono text-zinc-300">status: {activeOrder.orderStatus}</span>
						{/if}
					</p>
					{#if activeOrder.customerUniqueId || activeOrder.customerZipCodePrefix}
						<p data-testid="olist-customer-geo" class="mt-0.5 font-mono text-[10px] text-zinc-500">
							{#if activeOrder.customerUniqueId}uid: {activeOrder.customerUniqueId}{/if}
							{#if activeOrder.customerZipCodePrefix} · CEP {activeOrder.customerZipCodePrefix}{/if}
							{#if activeOrder.customerCity && activeOrder.customerState} · {activeOrder.customerCity}/{activeOrder.customerState}{/if}
						</p>
					{/if}
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

			<!-- Olist 5-Milestone Delivery Lifecycle (olist_orders) -->
			{#if activeOrder.lifecycle}
				<div class="mt-5" data-testid="olist-lifecycle-timeline">
					<h2 class="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
						Olist Order Lifecycle (5 Timestamps)
					</h2>
					<dl class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
						<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-2">
							<dt class="font-mono text-[10px] text-zinc-500 uppercase">Purchased</dt>
							<dd class="mt-0.5 font-mono text-[11px] text-zinc-200">
								{formatShortDate(activeOrder.lifecycle.purchaseTimestamp)}
							</dd>
						</div>
						<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-2">
							<dt class="font-mono text-[10px] text-zinc-500 uppercase">Approved</dt>
							<dd class="mt-0.5 font-mono text-[11px] text-zinc-200">
								{formatShortDate(activeOrder.lifecycle.approvedAt)}
							</dd>
						</div>
						<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-2">
							<dt class="font-mono text-[10px] text-zinc-500 uppercase">Carrier</dt>
							<dd class="mt-0.5 font-mono text-[11px] text-zinc-200">
								{formatShortDate(activeOrder.lifecycle.deliveredCarrierDate)}
							</dd>
						</div>
						<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-2">
							<dt class="font-mono text-[10px] text-zinc-500 uppercase">Delivered</dt>
							<dd class="mt-0.5 font-mono text-[11px] {activeOrder.lifecycle.deliveredCustomerDate ? 'text-emerald-300' : 'text-amber-300'}">
								{formatShortDate(activeOrder.lifecycle.deliveredCustomerDate)}
							</dd>
						</div>
						<div class="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-2">
							<dt class="font-mono text-[10px] text-zinc-500 uppercase">Estimated SLA</dt>
							<dd class="mt-0.5 font-mono text-[11px] text-zinc-200">
								{formatShortDate(activeOrder.lifecycle.estimatedDeliveryDate)}
							</dd>
						</div>
					</dl>
				</div>
			{/if}

			<!-- Itemized Goods (olist_order_items + olist_products + olist_sellers + olist_category_translation) -->
			<div class="mt-5">
				<h2 class="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
					Itemized Goods
				</h2>
				<div
					data-testid="itemized-goods-list"
					class="mt-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50"
				>
					<table class="w-full text-left text-xs">
						<thead class="border-b border-zinc-800 bg-zinc-950/70 font-mono text-[10px] text-zinc-400 uppercase">
							<tr>
								<th scope="col" class="px-3 py-2">SKU / Product</th>
								<th scope="col" class="px-3 py-2">Item</th>
								<th scope="col" class="px-3 py-2">Category</th>
								<th scope="col" class="px-3 py-2">Seller</th>
								<th scope="col" class="px-3 py-2 text-right">Qty</th>
								<th scope="col" class="px-3 py-2 text-right">Price / Freight</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-zinc-800/80">
							{#each activeOrder.items as item, index (`${item.sku}-${index}`)}
								<tr class="text-zinc-200">
									<td class="px-3 py-2.5 font-mono text-[11px] text-zinc-400">
										<div>{item.sku}</div>
										{#if item.productId}
											<div class="text-[10px] text-zinc-500">{item.productId.slice(0, 14)}</div>
										{/if}
									</td>
									<td class="px-3 py-2.5 font-medium text-zinc-100">{item.name}</td>
									<td class="px-3 py-2.5 text-zinc-400">
										<div>{item.categoryEnglish ?? item.category}</div>
										{#if item.categoryEnglish && item.category !== item.categoryEnglish}
											<div class="font-mono text-[10px] text-zinc-500">{item.category}</div>
										{/if}
									</td>
									<td class="px-3 py-2.5 font-mono text-[11px] text-zinc-400">
										{#if item.sellerCity && item.sellerState}
											<div>{item.sellerCity}/{item.sellerState}</div>
										{/if}
										{#if item.sellerId}
											<div class="text-[10px] text-zinc-500">{item.sellerId.slice(0, 12)}</div>
										{:else}
											<span>—</span>
										{/if}
									</td>
									<td class="px-3 py-2.5 text-right font-mono">{item.quantity}</td>
									<td class="px-3 py-2.5 text-right font-mono text-zinc-200">
										<div>{formatBrl(item.unitPriceBrl)}</div>
										{#if typeof item.freightValueBrl === 'number'}
											<div class="text-[10px] text-zinc-500">
												+{formatBrl(item.freightValueBrl)} freight
											</div>
										{/if}
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="6" class="px-3 py-4 text-center text-xs text-zinc-500">
										No itemized goods recorded.
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Payment Legs (olist_order_payments) -->
			{#if activeOrder.payments && activeOrder.payments.length > 0}
				<div class="mt-5" data-testid="order-payments-card">
					<div class="flex items-center justify-between gap-2">
						<h2 class="font-mono text-xs font-semibold tracking-wider text-zinc-400 uppercase">
							Payment Legs (olist_order_payments)
						</h2>
						{#if typeof activeOrder.courtesyCreditBrl === 'number' && activeOrder.courtesyCreditBrl > 0}
							<span class="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] text-amber-300">
								Courtesy Credit: {formatBrl(activeOrder.courtesyCreditBrl)}
							</span>
						{/if}
					</div>
					<div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
						{#each activeOrder.payments as payment (payment.paymentSequential)}
							<div
								data-testid="payment-leg-{payment.paymentSequential}"
								class="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 font-mono text-xs"
							>
								<div>
									<span class="text-zinc-500">#{payment.paymentSequential}</span>
									<span class="ml-1.5 text-zinc-200">{payment.paymentType}</span>
									<span class="ml-1.5 text-[10px] text-zinc-500">
										({payment.paymentInstallments}x)
									</span>
								</div>
								<span class="font-semibold text-emerald-300">
									{formatBrl(payment.paymentValueBrl)}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Customer Review with 1-Click Translation Toggle (olist_order_reviews) -->
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
						{#if activeOrder.reviewMeta?.reviewId}
							<span class="font-mono text-[10px] text-zinc-500">
								{activeOrder.reviewMeta.reviewId.slice(0, 12)}
							</span>
						{/if}
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
					{#if activeOrder.reviewMeta?.title}
						<p class="mb-1 font-mono text-xs font-semibold text-zinc-300">
							{activeOrder.reviewMeta.title}
						</p>
					{/if}
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
