import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

import InvestigationScreen from './InvestigationScreen.svelte';
import StudioShell from './StudioShell.svelte';
import { createInvestigationStore } from '$lib/stores/investigation.svelte';
import { createSessionStore } from '$lib/stores/session.svelte';
import { createWorkspaceStore } from '$lib/stores/workspace.svelte';

describe('InvestigationScreen', () => {
	let sessionStore: ReturnType<typeof createSessionStore>;
	let store: ReturnType<typeof createInvestigationStore>;

	beforeEach(() => {
		sessionStore = createSessionStore();
		sessionStore.login({
			token: 'jwt-test-token',
			username: 'carlos.support',
			role: 'customer_specialist',
			tenant: 'SP-01'
		});
		store = createInvestigationStore();
	});

	it('renders 3-column layout (240px queue, flex-1 canvas, 420px copilot), SLA badge, LTV, and itemized goods', () => {
		render(InvestigationScreen, { props: { sessionStore, store } });

		const leftQueue = screen.getByTestId('investigation-left-queue');
		const middleCanvas = screen.getByTestId('investigation-middle-canvas');
		const rightCopilot = screen.getByTestId('investigation-right-copilot');

		expect(leftQueue).toHaveClass('lg:w-[240px]');
		expect(middleCanvas).toHaveClass('flex-1');
		expect(rightCopilot).toHaveClass('lg:w-[420px]');

		expect(screen.getByTestId('sla-status-badge')).toHaveTextContent('SLA BREACHED (+8.4 Days)');
		expect(screen.getByTestId('customer-ltv-card')).toHaveTextContent('R$ 4.820,50');
		expect(screen.getByTestId('customer-ltv-card')).toHaveTextContent('Mariana Oliveira');

		const goods = screen.getByTestId('itemized-goods-list');
		expect(goods).toHaveTextContent('Cafeteira Expresso Oster PrimaLatte II');
		expect(goods).toHaveTextContent('Conjunto Xícaras Porcelana 6 Peças');
	});

	it('toggles customer review between Portuguese and English with 1 click', async () => {
		render(InvestigationScreen, { props: { sessionStore, store } });

		const reviewText = screen.getByTestId('customer-review-text');
		const toggleBtn = screen.getByTestId('translation-toggle-btn');

		expect(reviewText).toHaveTextContent('Comprei a cafeteira para o aniversário da minha mãe');
		expect(toggleBtn).toHaveTextContent('Translate to English');
		expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');

		await fireEvent.click(toggleBtn);
		expect(reviewText).toHaveTextContent(
			'I bought the espresso maker for my mother’s birthday'
		);
		expect(toggleBtn).toHaveTextContent('Show Original (PT-BR)');
		expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');

		await fireEvent.click(toggleBtn);
		expect(reviewText).toHaveTextContent('Comprei a cafeteira para o aniversário da minha mãe');
	});

	it('renders ThoughtAccordion with collapsible steps, latency pills, and tool call badges', async () => {
		render(InvestigationScreen, { props: { sessionStore, store } });

		const accordionToggle = screen.getByTestId('thought-accordion-toggle');
		expect(accordionToggle).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByTestId('thought-total-latency')).toHaveTextContent('101ms');
		expect(screen.getByTestId('thought-accordion-body')).toBeInTheDocument();

		const toolBadges = screen.getAllByTestId('tool-call-badge');
		expect(toolBadges).toHaveLength(3);
		expect(toolBadges[0]).toHaveTextContent('olist.orders.get_telemetry');
		expect(toolBadges[0]).toHaveTextContent('38ms');

		await fireEvent.click(accordionToggle);
		expect(accordionToggle).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByTestId('thought-accordion-body')).not.toBeInTheDocument();
	});

	it('approves R$ 29,80 credit via POST /api/v1/commands/orders/issue-credit, guards double-submit, and shows amber toast', async () => {
		let resolveFetch!: (value: Response) => void;
		const pendingResponse = new Promise<Response>((resolve) => {
			resolveFetch = resolve;
		});
		const mockFetch = vi.fn(() => pendingResponse) as unknown as typeof fetch;

		render(InvestigationScreen, { props: { sessionStore, store, fetcher: mockFetch } });

		const approveBtn = screen.getByTestId('hitl-approve-btn');
		expect(approveBtn).toHaveTextContent('Approve R$ 29,80 Credit');
		expect(screen.getByTestId('hitl-dismiss-btn')).toHaveTextContent('Dismiss');

		// First click starts submission; second click is guarded.
		await fireEvent.click(approveBtn);
		expect(approveBtn).toBeDisabled();
		expect(approveBtn).toHaveAttribute('aria-busy', 'true');
		expect(approveBtn).toHaveTextContent('Approving R$ 29,80...');
		expect(screen.getByTestId('hitl-dismiss-btn')).toBeDisabled();
		await fireEvent.click(approveBtn);
		expect(mockFetch).toHaveBeenCalledTimes(1);

		const [url, init] = (mockFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toBe('/api/v1/commands/orders/issue-credit');
		expect(init.method).toBe('POST');
		expect(init.headers).toMatchObject({
			Authorization: 'Bearer jwt-test-token',
			'Content-Type': 'application/json'
		});
		expect(JSON.parse(init.body as string)).toEqual({
			order_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
			amount_cents: 2980,
			reason: 'SLA breach (+8.4 Days) courtesy freight & retention credit'
		});

		resolveFetch(
			new Response(
				JSON.stringify({
					command_id: 'cmd-94821',
					status: 'ACCEPTED',
					timestamp: '2026-11-14T02:30:00Z'
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		expect(await screen.findByTestId('hitl-proposal-approved')).toHaveTextContent(
			'Approved · R$ 29,80 Credit Dispatched'
		);
		const toast = await screen.findByTestId('amber-toast');
		expect(toast).toHaveAttribute('role', 'status');
		expect(toast).toHaveTextContent('Courtesy credit R$ 29,80 issued');

		await fireEvent.click(screen.getByTestId('toast-dismiss-btn'));
		expect(screen.queryByTestId('amber-toast')).not.toBeInTheDocument();
	});

	it('displays an error alert when credit POST fails and allows retry', async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ message: 'Policy guardrail timeout' }), {
					status: 502,
					headers: { 'Content-Type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ commandId: 'cmd-retry', status: 'ISSUED' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			) as unknown as typeof fetch;

		render(InvestigationScreen, { props: { sessionStore, store, fetcher: mockFetch } });

		await fireEvent.click(screen.getByTestId('hitl-approve-btn'));
		const errorAlert = await screen.findByTestId('hitl-proposal-error');
		expect(errorAlert).toHaveAttribute('role', 'alert');
		expect(errorAlert).toHaveTextContent('Policy guardrail timeout');

		// Retry succeeds
		await fireEvent.click(screen.getByTestId('hitl-approve-btn'));
		expect(await screen.findByTestId('hitl-proposal-approved')).toBeInTheDocument();
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('dismisses proposal without calling API, isolates per-order state, and blocks approveProposal on dismissed order', async () => {
		const mockFetch = vi.fn() as unknown as typeof fetch;
		render(InvestigationScreen, { props: { sessionStore, store, fetcher: mockFetch } });

		await fireEvent.click(screen.getByTestId('hitl-dismiss-btn'));
		expect(screen.getByTestId('hitl-proposal-dismissed')).toBeInTheDocument();
		expect(mockFetch).not.toHaveBeenCalled();

		// Switching to another order shows its own pending proposal
		await fireEvent.click(screen.getByTestId('queue-order-OL-94790-RJ'));
		expect(screen.getByTestId('sla-status-badge')).toHaveTextContent('AT RISK (+1.2 Days)');
		expect(screen.getByTestId('hitl-approve-btn')).toHaveTextContent('Approve R$ 15,00 Credit');

		// Switching back preserves dismissed state and approveProposal is blocked
		await fireEvent.click(screen.getByTestId('queue-order-OL-94821-SP'));
		expect(screen.getByTestId('hitl-proposal-dismissed')).toBeInTheDocument();
		const approved = await store.approveProposal(sessionStore.token, mockFetch);
		expect(approved).toBe(false);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('shows error banner without calling fetch when sessionStore.token is null', async () => {
		sessionStore.logout();
		const mockFetch = vi.fn() as unknown as typeof fetch;
		render(InvestigationScreen, { props: { sessionStore, store, fetcher: mockFetch } });

		await fireEvent.click(screen.getByTestId('hitl-approve-btn'));
		const errorAlert = await screen.findByTestId('hitl-proposal-error');
		expect(errorAlert).toHaveAttribute('role', 'alert');
		expect(errorAlert).toHaveTextContent('Operator bearer token is missing');
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('renders InvestigationScreen inside StudioShell when active path is /investigation', () => {
		const workspaceStore = createWorkspaceStore('/investigation');
		render(StudioShell, { props: { sessionStore, workspaceStore } });

		expect(screen.getByTestId('screen-investigation')).toBeInTheDocument();
		expect(screen.getByTestId('hitl-proposal-card')).toBeInTheDocument();
	});

	it('renders 9-table Olist lifecycle timeline, payment legs, customer geo, and seller/freight details', () => {
		render(InvestigationScreen, { props: { sessionStore, store } });

		expect(screen.getByTestId('olist-lifecycle-timeline')).toBeInTheDocument();
		expect(screen.getByTestId('olist-customer-geo')).toHaveTextContent('CEP 01310');
		expect(screen.getByTestId('order-payments-card')).toBeInTheDocument();
		expect(screen.getByTestId('payment-leg-1')).toHaveTextContent('credit_card');
		expect(screen.getByTestId('payment-leg-2')).toHaveTextContent('voucher');
		expect(screen.getByTestId('itemized-goods-list')).toHaveTextContent('small_appliances');
		expect(screen.getByTestId('itemized-goods-list')).toHaveTextContent('Curitiba/PR');
	});
});
