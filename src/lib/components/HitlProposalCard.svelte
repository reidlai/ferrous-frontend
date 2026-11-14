<script lang="ts">
	import type { CreditProposal } from '$lib/api/orders';
	import type { ProposalStatus } from '$lib/stores/investigation.svelte';

	interface HitlProposalCardProps {
		proposal: CreditProposal;
		status: ProposalStatus;
		errorMessage: string | null;
		onApprove: () => void | Promise<unknown>;
		onDismiss: () => void;
	}

	let { proposal, status, errorMessage, onApprove, onDismiss }: HitlProposalCardProps = $props();

	const isSubmitting = $derived(status === 'submitting');
	const isResolved = $derived(status === 'approved' || status === 'dismissed');
	const hasValidAmount = $derived(
		typeof proposal.amountBrl === 'number' &&
			Number.isFinite(proposal.amountBrl) &&
			proposal.amountBrl > 0
	);
</script>

<section
	data-testid="hitl-proposal-card"
	aria-label="Human in the loop credit proposal"
	class="rounded-xl border border-amber-500/35 bg-zinc-900/90 p-3.5 shadow-[0_0_24px_rgba(245,158,11,0.06)]"
>
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<span class="inline-flex h-2 w-2 rounded-full bg-amber-400"></span>
			<span class="font-mono text-[11px] font-semibold tracking-wider text-amber-300 uppercase">
				HITL Action Proposal
			</span>
		</div>
		<span class="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
			{proposal.policyCode}
		</span>
	</div>

	<div class="mt-2.5 flex items-baseline justify-between gap-2">
		<p class="text-xs text-zinc-300">{proposal.reason}</p>
		<span class="shrink-0 font-mono text-sm font-semibold text-amber-300">
			{proposal.formattedAmount}
		</span>
	</div>

	{#if errorMessage}
		<div
			role="alert"
			data-testid="hitl-proposal-error"
			class="mt-3 rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs text-red-200"
		>
			{errorMessage}
		</div>
	{/if}

	{#if status === 'approved'}
		<div
			data-testid="hitl-proposal-approved"
			class="mt-3 flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200"
		>
			<span>Approved · {proposal.formattedAmount} Credit Dispatched</span>
			<span class="font-mono text-[10px] text-amber-300/80 uppercase">Committed</span>
		</div>
	{:else if status === 'dismissed'}
		<div
			data-testid="hitl-proposal-dismissed"
			class="mt-3 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-400"
		>
			Proposal dismissed by operator. No credit command dispatched.
		</div>
	{:else}
		<div class="mt-3.5 flex items-center gap-2">
			<button
				type="button"
				data-testid="hitl-approve-btn"
				disabled={isSubmitting || isResolved || !hasValidAmount}
				aria-busy={isSubmitting}
				onclick={onApprove}
				class="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 focus:ring-2 focus:ring-amber-400/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
			>
				{isSubmitting ? `Approving ${proposal.formattedAmount}...` : `Approve ${proposal.formattedAmount} Credit`}
			</button>

			<button
				type="button"
				data-testid="hitl-dismiss-btn"
				disabled={isSubmitting || isResolved}
				onclick={onDismiss}
				class="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 focus:ring-2 focus:ring-zinc-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
			>
				Dismiss
			</button>
		</div>
	{/if}
</section>
