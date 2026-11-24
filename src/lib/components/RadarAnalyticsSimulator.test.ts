import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

import { goto } from '$app/navigation';
import AnalyticsScreen from './AnalyticsScreen.svelte';
import RadarScreen from './RadarScreen.svelte';
import SimulatorScreen from './SimulatorScreen.svelte';
import StudioShell from './StudioShell.svelte';
import { createInvestigationStore } from '$lib/stores/investigation.svelte';
import { createRadarStore } from '$lib/stores/radar.svelte';
import { createSessionStore } from '$lib/stores/session.svelte';
import { REPLAY_QUICKSTART_URL, createWorkspaceStore } from '$lib/stores/workspace.svelte';

describe('Story 10.4: RadarScreen, AnalyticsScreen, SimulatorScreen', () => {
	let radarStore: ReturnType<typeof createRadarStore>;
	let invStore: ReturnType<typeof createInvestigationStore>;
	let workspaceStore: ReturnType<typeof createWorkspaceStore>;
	let sessionStore: ReturnType<typeof createSessionStore>;

	beforeEach(() => {
		vi.clearAllMocks();
		radarStore = createRadarStore();
		invStore = createInvestigationStore();
		workspaceStore = createWorkspaceStore('/radar');
		sessionStore = createSessionStore();
		sessionStore.login({
			token: 'jwt-test-token',
			username: 'carlos.support',
			role: 'customer_specialist',
			tenant: 'SP-01'
		});
	});

	describe('RadarScreen', () => {
		it('displays 418 active SLA breaches and filters by UF (SP, RJ, MG) and search query', async () => {
			render(RadarScreen, { props: { store: radarStore, invStore, workspaceStore } });

			expect(screen.getByTestId('radar-total-breaches')).toHaveTextContent('418');
			expect(screen.getByTestId('radar-filtered-count')).toHaveTextContent('(9 shown)');

			await fireEvent.click(screen.getByTestId('radar-uf-pill-SP'));
			expect(screen.getByTestId('radar-row-OL-94821-SP')).toBeInTheDocument();
			expect(screen.queryByTestId('radar-row-OL-94790-RJ')).not.toBeInTheDocument();
			expect(screen.getByTestId('radar-filtered-count')).toHaveTextContent('(3 shown)');

			await fireEvent.click(screen.getByTestId('radar-uf-pill-RJ'));
			expect(screen.getByTestId('radar-row-OL-94790-RJ')).toBeInTheDocument();
			expect(screen.queryByTestId('radar-row-OL-94821-SP')).not.toBeInTheDocument();
			expect(screen.getByTestId('radar-filtered-count')).toHaveTextContent('(2 shown)');

			await fireEvent.click(screen.getByTestId('radar-uf-pill-MG'));
			expect(screen.getByTestId('radar-row-OL-94615-MG')).toBeInTheDocument();
			expect(screen.getByTestId('radar-filtered-count')).toHaveTextContent('(2 shown)');

			await fireEvent.click(screen.getByTestId('radar-uf-pill-ALL'));
			const searchInput = screen.getByTestId('radar-search-input');
			await fireEvent.input(searchInput, { target: { value: 'Mariana' } });
			expect(screen.getByTestId('radar-row-OL-94821-SP')).toBeInTheDocument();
			expect(screen.getByTestId('radar-filtered-count')).toHaveTextContent('(1 shown)');
		});

		it('filters by carrier select and resets filters cleanly via Reset filters button', async () => {
			render(RadarScreen, { props: { store: radarStore, invStore, workspaceStore } });

			const carrierSelect = screen.getByTestId('radar-carrier-select');
			await fireEvent.change(carrierSelect, { target: { value: 'DirectLog' } });
			expect(screen.getByTestId('radar-filtered-count')).toHaveTextContent('(3 shown)');
			expect(screen.getByTestId('radar-row-OL-94588-SP')).toBeInTheDocument();
			expect(screen.queryByTestId('radar-row-OL-94821-SP')).not.toBeInTheDocument();

			await fireEvent.input(screen.getByTestId('radar-search-input'), {
				target: { value: 'NON-EXISTENT-ORDER-999' }
			});
			expect(screen.getByTestId('radar-empty-state')).toBeInTheDocument();
			expect(screen.getByTestId('radar-filtered-count')).toHaveTextContent('(0 shown)');

			const resetBtn = screen.getByRole('button', { name: 'Reset filters' });
			await fireEvent.click(resetBtn);
			expect(screen.queryByTestId('radar-empty-state')).not.toBeInTheDocument();
			expect(screen.getByTestId('radar-filtered-count')).toHaveTextContent('(9 shown)');
		});

		it('shows empty queue message without Reset filters when store.breaches is empty', () => {
			const emptyStore = createRadarStore([]);
			render(RadarScreen, { props: { store: emptyStore, invStore, workspaceStore } });

			expect(screen.getByTestId('radar-empty-state')).toHaveTextContent(
				'No active SLA breaches in queue'
			);
			expect(screen.queryByTestId('radar-clear-filters-btn')).not.toBeInTheDocument();
		});

		it('selects order in investigationStore and navigates to /investigation when Investigate is clicked', async () => {
			render(RadarScreen, { props: { store: radarStore, invStore, workspaceStore } });

			await fireEvent.click(screen.getByTestId('investigate-btn-OL-94790-RJ'));

			expect(invStore.activeOrderId).toBe('OL-94790-RJ');
			expect(workspaceStore.currentPath).toBe('/investigation');
			expect(goto).toHaveBeenCalledWith('/investigation');
		});

		it('falls back gracefully to matching UF order when investigating a non-queued breach', async () => {
			invStore.selectOrder('OL-94821-SP');
			render(RadarScreen, { props: { store: radarStore, invStore, workspaceStore } });

			await fireEvent.click(screen.getByTestId('investigate-btn-OL-94512-RJ'));

			expect(invStore.activeOrderId).toBe('OL-94790-RJ');
			expect(workspaceStore.currentPath).toBe('/investigation');
		});
	});

	describe('AnalyticsScreen', () => {
		it('renders Correios SEDEX vs DirectLog cards and interactive Regional Delay Clusters', async () => {
			render(AnalyticsScreen, { props: { store: radarStore } });

			const correiosCard = screen.getByTestId('carrier-card-correios-sedex');
			const directLogCard = screen.getByTestId('carrier-card-directlog');

			expect(correiosCard).toHaveTextContent('Correios SEDEX');
			expect(correiosCard).toHaveTextContent('86.4%');
			expect(directLogCard).toHaveTextContent('DirectLog');
			expect(directLogCard).toHaveTextContent('91.8%');

			expect(screen.getByTestId('regional-delay-clusters')).toBeInTheDocument();
			for (const uf of ['SP', 'RJ', 'MG', 'BA', 'RS']) {
				expect(screen.getByTestId(`cluster-row-${uf}`)).toBeInTheDocument();
			}
			expect(screen.getByTestId('selected-cluster-summary')).toHaveTextContent(
				'Focused UF: SP (São Paulo)'
			);

			await fireEvent.click(screen.getByTestId('cluster-row-BA'));
			expect(screen.getByTestId('selected-cluster-summary')).toHaveTextContent(
				'Focused UF: BA (Bahia)'
			);
		});
	});

	describe('SimulatorScreen', () => {
		it('renders read-only ReplayStatusPill, 4 Iggy topics, tidb-sink lag, all 9 Olist TiDB tables + orders_current_state, quickstart, and ZERO playback controls', () => {
			render(SimulatorScreen);

			const pill = screen.getByTestId('replay-status-pill');
			expect(pill).toHaveTextContent('STREAMING (READ-ONLY)');
			expect(pill).toHaveTextContent('olist/orders_stream');
			expect(pill).toHaveTextContent('24.8 msgs/s');
			expect(pill).toHaveTextContent('83.9%');

			const topicInspector = screen.getByTestId('iggy-topic-inspector');
			expect(topicInspector).toHaveTextContent('olist/orders_stream');
			expect(topicInspector).toHaveTextContent('olist/order_items_stream');
			expect(topicInspector).toHaveTextContent('olist/order_payments_stream');
			expect(topicInspector).toHaveTextContent('olist/order_reviews_stream');
			expect(topicInspector).toHaveTextContent('24.8 msgs/s');
			expect(topicInspector).toHaveTextContent('1,048,291');
			expect(topicInspector).toHaveTextContent('1,250,000');
			expect(topicInspector).toHaveTextContent('83.9%');

			const cgInspector = screen.getByTestId('consumer-group-inspector');
			expect(cgInspector).toHaveTextContent('tidb-sink');
			expect(cgInspector).toHaveTextContent('0 msgs');

			const tidbMonitor = screen.getByTestId('delta-tables-monitor');
			for (const table of [
				'olist_orders',
				'olist_order_items',
				'olist_order_payments',
				'olist_order_reviews',
				'olist_customers',
				'olist_products',
				'olist_sellers',
				'olist_geolocation',
				'olist_category_translation',
				'orders_current_state'
			]) {
				expect(tidbMonitor).toHaveTextContent(table);
			}

			const quickstartCard = screen.getByTestId('replay-quickstart-card');
			expect(quickstartCard).toHaveTextContent('ferrous-cx');
			expect(quickstartCard).toHaveTextContent('make quickstart');
			expect(quickstartCard).toHaveTextContent('stream-replay-rs');
			const quickstartLink = screen.getByRole('link', { name: 'ferrous-cx Quickstart' });
			expect(quickstartLink).toHaveAttribute('href', REPLAY_QUICKSTART_URL);
			expect(quickstartLink).toHaveAttribute('rel', 'noreferrer');

			// Strict Read-Only constraint: ZERO Play, Pause, Resume, Reset, Speed, Loop, or Burst-Inject buttons
			const buttons = screen.queryAllByRole('button');
			expect(buttons).toHaveLength(0);
			const forbiddenText = /\b(play|pause|resume|reset|speed|1x|10x|loop|burst)\b/i;
			expect(screen.getByTestId('screen-simulator').textContent).not.toMatch(forbiddenText);
		});
	});

	describe('StudioShell route wiring', () => {
		it('renders RadarScreen, AnalyticsScreen, SimulatorScreen, and navigates /radar -> [Investigate] -> screen-investigation', async () => {
			const ws = createWorkspaceStore('/radar');
			const { rerender } = render(StudioShell, {
				props: { sessionStore, workspaceStore: ws }
			});
			expect(screen.getByTestId('screen-radar')).toBeInTheDocument();
			expect(screen.getByTestId('radar-total-breaches')).toHaveTextContent('418');

			ws.setCurrentPath('/analytics');
			await rerender({ sessionStore, workspaceStore: ws });
			expect(screen.getByTestId('screen-analytics')).toBeInTheDocument();
			expect(screen.getByTestId('carrier-card-correios-sedex')).toBeInTheDocument();

			ws.setCurrentPath('/simulator');
			await rerender({ sessionStore, workspaceStore: ws });
			expect(screen.getByTestId('screen-simulator')).toBeInTheDocument();
			expect(screen.getByTestId('replay-status-pill')).toBeInTheDocument();

			ws.setCurrentPath('/radar');
			await rerender({ sessionStore, workspaceStore: ws });
			await fireEvent.click(screen.getByTestId('investigate-btn-OL-94790-RJ'));
			expect(ws.currentPath).toBe('/investigation');
			expect(screen.getByTestId('screen-investigation')).toBeInTheDocument();
		});
	});
});
