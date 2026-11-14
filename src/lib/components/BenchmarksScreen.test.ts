import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

import BenchmarksScreen from './BenchmarksScreen.svelte';
import StudioShell from './StudioShell.svelte';
import { benchmarksStore, createBenchmarksStore } from '$lib/stores/benchmarks.svelte';
import { createSessionStore } from '$lib/stores/session.svelte';
import { createWorkspaceStore } from '$lib/stores/workspace.svelte';

describe('Story 10.5: BenchmarksScreen & StudioShell /benchmarks wiring', () => {
	let store: ReturnType<typeof createBenchmarksStore>;
	let sessionStore: ReturnType<typeof createSessionStore>;
	let workspaceStore: ReturnType<typeof createWorkspaceStore>;

	beforeEach(() => {
		vi.clearAllMocks();
		store = createBenchmarksStore();
		sessionStore = createSessionStore();
		sessionStore.login({
			token: 'jwt-bench-token',
			username: 'ana.lead',
			role: 'ops_lead',
			tenant: 'SP-01'
		});
		workspaceStore = createWorkspaceStore('/benchmarks');
		benchmarksStore.reset();
	});

	it('renders model pills, category tabs, TTFT HUD, and PASS tool validation badge', async () => {
		render(BenchmarksScreen, { props: { store, sessionStore } });

		expect(screen.getByTestId('screen-benchmarks')).toBeInTheDocument();
		expect(screen.getByTestId('model-pill-qwen-2.5-72b')).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByTestId('model-pill-gpt-4o')).toHaveAttribute('aria-pressed', 'false');

		await fireEvent.click(screen.getByTestId('model-pill-gpt-4o'));
		expect(screen.getByTestId('model-pill-gpt-4o')).toHaveAttribute('aria-pressed', 'true');

		await fireEvent.click(screen.getByTestId('category-tab-hitl-guardrails'));
		expect(screen.getByTestId('category-tab-hitl-guardrails')).toHaveAttribute(
			'aria-selected',
			'true'
		);

		expect(screen.getByTestId('ttft-hud')).toBeInTheDocument();
		expect(screen.getByTestId('ttft-formatted-value')).toHaveTextContent('182.4ms (182,400 μs)');
		expect(screen.getByTestId('ttft-tier-badge')).toHaveTextContent('FAST');
		expect(screen.getByTestId('tool-validation-badge')).toHaveTextContent('PASS');
	});

	it('streams SSE benchmark telemetry into the terminal and supports aborting a running suite', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
		try {
			render(BenchmarksScreen, { props: { store, sessionStore } });

			await fireEvent.click(screen.getByTestId('run-benchmark-btn'));
			expect(screen.getByTestId('abort-benchmark-btn')).toBeInTheDocument();

			await fireEvent.click(screen.getByTestId('abort-benchmark-btn'));
			expect(screen.getByTestId('benchmark-status-pill')).toHaveTextContent('aborted');
			expect(screen.getByTestId('benchmark-terminal')).toHaveTextContent(
				'[ABORT] Benchmark run cancelled by operator.'
			);

			// Re-run and let it complete cleanly
			await fireEvent.click(screen.getByTestId('run-benchmark-btn'));
			await waitFor(() => {
				expect(screen.getByTestId('benchmark-status-pill')).toHaveTextContent('completed');
			});
			expect(screen.getByTestId('benchmark-terminal')).toHaveTextContent(
				'[DONE] Benchmark suite finished'
			);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('displays DataFusion SQL comparative query panel over delta/llm_benchmarks/ with < 3ms badge', async () => {
		render(BenchmarksScreen, { props: { store, sessionStore } });

		const panel = screen.getByTestId('datafusion-sql-panel');
		expect(panel).toHaveTextContent('delta/llm_benchmarks/');
		expect(screen.getByTestId('datafusion-latency-badge')).toHaveTextContent('2.1ms DataFusion');
		expect(screen.getByTestId('datafusion-results-table')).toHaveTextContent('qwen-2.5-72b');

		const sqlInput = screen.getByTestId('datafusion-sql-input');
		await fireEvent.input(sqlInput, {
			target: {
				value:
					"SELECT model_id, ROUND(AVG(ttft_ms), 2) AS avg_ttft_ms FROM delta.llm_benchmarks WHERE model_id = 'claude-3.5-sonnet' GROUP BY model_id;"
			}
		});
		await fireEvent.click(screen.getByTestId('datafusion-run-btn'));

		const table = screen.getByTestId('datafusion-results-table');
		expect(table).toHaveTextContent('claude-3.5-sonnet');
		expect(table).not.toHaveTextContent('qwen-2.5-72b');
	});

	it('wires /benchmarks in StudioShell and resets benchmarksStore on tenant switch/logout', async () => {
		render(StudioShell, {
			props: {
				initialPath: '/benchmarks',
				sessionStore,
				workspaceStore
			}
		});

		expect(screen.getByTestId('screen-benchmarks')).toBeInTheDocument();
		benchmarksStore.setCategory('tool-calling');
		expect(benchmarksStore.activeCategory).toBe('tool-calling');

		sessionStore.setTenant('RJ-01');
		await waitFor(() => {
			expect(benchmarksStore.activeCategory).toBe('all');
		});
	});
});
