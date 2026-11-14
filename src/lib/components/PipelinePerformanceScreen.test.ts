import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

import PipelinePerformanceScreen from './PipelinePerformanceScreen.svelte';
import StudioShell from './StudioShell.svelte';
import { createPipelineStore, DEFAULT_PIPELINE_COUNTERS, pipelineStore } from '$lib/stores/pipeline.svelte';
import { createSessionStore } from '$lib/stores/session.svelte';
import { createWorkspaceStore } from '$lib/stores/workspace.svelte';

describe('Story 10.6: PipelinePerformanceScreen & StudioShell /pipeline-performance wiring', () => {
	let store: ReturnType<typeof createPipelineStore>;
	let sessionStore: ReturnType<typeof createSessionStore>;
	let workspaceStore: ReturnType<typeof createWorkspaceStore>;

	beforeEach(() => {
		vi.clearAllMocks();
		store = createPipelineStore();
		sessionStore = createSessionStore();
		sessionStore.login({
			token: 'jwt-pipeline-token',
			username: 'ana.lead',
			role: 'ops_lead',
			tenant: 'SP-01'
		});
		workspaceStore = createWorkspaceStore('/pipeline-performance');
		pipelineStore.reset();
	});

	it('renders 4-stage topology banner, pulsating health pills, labels, and Delta partition counts', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
		try {
			render(PipelinePerformanceScreen, { props: { store, sessionStore } });

			const root = screen.getByTestId('screen-pipeline-performance');
			expect(root).toBeInTheDocument();

			const banner = screen.getByTestId('pipeline-topology-banner');
			expect(banner).toHaveTextContent('stream-replay-rs');
			expect(banner).toHaveTextContent('Apache Iggy');
			expect(banner).toHaveTextContent('Arroyo');
			expect(banner).toHaveTextContent('Delta Lake');

			expect(screen.getByTestId('health-pill-stream-replay-rs')).toHaveTextContent('24.8 msgs/s');
			expect(screen.getByTestId('health-pill-apache-iggy')).toHaveTextContent('0.38ms fsync');
			expect(screen.getByTestId('health-pill-arroyo')).toHaveTextContent('0.12s watermark lag');
			expect(screen.getByTestId('health-pill-delta-lake')).toHaveTextContent('1.8ms commit log');

			expect(root).toHaveTextContent('0 msgs');
			expect(root).toHaveTextContent('cg-arroyo-olist');
			expect(root).toHaveTextContent('olist/orders_stream');
			expect(root).toHaveTextContent('ferrous-streaming');
			expect(root).toHaveTextContent('Olist Arroyo pipeline');

			expect(screen.getByTestId('partition-card-olist_orders')).toHaveTextContent('16 partitions');
			expect(screen.getByTestId('partition-card-olist_order_items')).toHaveTextContent('16 partitions');
			expect(screen.getByTestId('partition-card-olist_order_reviews')).toHaveTextContent('12 partitions');
			expect(screen.getByTestId('partition-card-olist_customers')).toHaveTextContent('8 partitions');

			await waitFor(() => {
				expect(screen.getByTestId('pipeline-terminal')).toHaveTextContent('olist/orders_stream');
			});
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('enforces strict read-only telemetry with zero control buttons', () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
		try {
			const { container } = render(PipelinePerformanceScreen, { props: { store, sessionStore } });

			expect(container.querySelectorAll('button')).toHaveLength(0);
			const text = container.textContent ?? '';
			expect(text).not.toMatch(/\b(Pause|Resume|Burst|Loop|Speed|Reset|Inject)\b/);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('renders pipeline-error-banner when stream encounters 401 Unauthorized', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
		vi.stubGlobal('fetch', fetcher);
		try {
			render(PipelinePerformanceScreen, { props: { store, sessionStore } });
			await waitFor(() => {
				const banner = screen.getByTestId('pipeline-error-banner');
				expect(banner).toBeInTheDocument();
				expect(banner).toHaveTextContent('401');
			});
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('windows terminal at 40 lines when store has more than 40 lines', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
		try {
			render(PipelinePerformanceScreen, { props: { store, sessionStore } });
			for (let i = 0; i < 60; i++) {
				store.applyPipelineSample({
					eventsEmitted: DEFAULT_PIPELINE_COUNTERS.eventsEmitted + i,
					text: `Virtual line ${i}`
				});
			}
			const terminal = screen.getByTestId('pipeline-terminal');
			const visibleDivs = terminal.querySelectorAll('div.flex');
			expect(visibleDivs.length).toBeLessThanOrEqual(40);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('renders counter testids and latency HUD percentiles for all 4 stages', () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
		try {
			render(PipelinePerformanceScreen, { props: { store, sessionStore } });

			expect(screen.getByTestId('counter-events-emitted')).toHaveTextContent('99,441');
			expect(screen.getByTestId('counter-iggy-offset')).toHaveTextContent('99,441');
			expect(screen.getByTestId('counter-arroyo-processed')).toHaveTextContent('99,441');
			expect(screen.getByTestId('counter-delta-rows')).toHaveTextContent('99,441');

			const cardReplay = screen.getByTestId('stage-card-stream-replay-rs');
			expect(cardReplay).toHaveTextContent('p50 1.4ms · p95 2.9ms · p99 4.6ms');

			const cardIggy = screen.getByTestId('stage-card-apache-iggy');
			expect(cardIggy).toHaveTextContent('p50 0.38ms · p95 0.72ms · p99 1.15ms');

			const cardArroyo = screen.getByTestId('stage-card-arroyo');
			expect(cardArroyo).toHaveTextContent('p50 8.2ms · p95 16.4ms · p99 28ms');

			const cardDelta = screen.getByTestId('stage-card-delta-lake');
			expect(cardDelta).toHaveTextContent('p50 1.8ms · p95 3.4ms · p99 5.9ms');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('calls store.disconnect() on unmount cleanup', () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
		const disconnectSpy = vi.spyOn(store, 'disconnect');
		try {
			const { unmount } = render(PipelinePerformanceScreen, { props: { store, sessionStore } });
			unmount();
			expect(disconnectSpy).toHaveBeenCalledTimes(1);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('wires /pipeline-performance in StudioShell and resets pipelineStore on tenant/auth change', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
		const resetSpy = vi.spyOn(pipelineStore, 'reset');
		try {
			render(StudioShell, {
				props: {
					initialPath: '/pipeline-performance',
					sessionStore,
					workspaceStore
				}
			});

			expect(screen.getByTestId('screen-pipeline-performance')).toBeInTheDocument();
			expect(screen.getByTestId('pipeline-topology-banner')).toBeInTheDocument();

			sessionStore.setTenant('RJ-02');
			await waitFor(() => {
				expect(resetSpy).toHaveBeenCalled();
			});
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
