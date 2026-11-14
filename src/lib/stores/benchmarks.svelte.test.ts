import { describe, expect, it, vi } from 'vitest';
import {
	classifyTtft,
	createBenchmarksStore,
	DELTA_LLM_BENCHMARKS_SOURCE,
	formatTtftMicros
} from './benchmarks.svelte';

describe('benchmarks.svelte.ts', () => {
	it('classifies TTFT thresholds accurately (emerald, amber, rose, NaN, negative)', () => {
		expect(classifyTtft(182)).toEqual({ label: 'FAST', tier: 'emerald' });
		expect(classifyTtft(200)).toEqual({ label: 'NOMINAL', tier: 'amber' });
		expect(classifyTtft(350)).toEqual({ label: 'NOMINAL', tier: 'amber' });
		expect(classifyTtft(500)).toEqual({ label: 'NOMINAL', tier: 'amber' });
		expect(classifyTtft(501)).toEqual({ label: 'SLOW', tier: 'rose' });
		expect(classifyTtft(Number.NaN)).toEqual({ label: 'SLOW', tier: 'rose' });
		expect(classifyTtft(-10)).toEqual({ label: 'SLOW', tier: 'rose' });
	});

	it('formats microsecond TTFT precision cleanly', () => {
		expect(formatTtftMicros(182.4)).toBe('182.4ms (182,400 μs)');
		expect(formatTtftMicros(Number.NaN)).toBe('0.0ms (0 μs)');
		expect(formatTtftMicros(-10)).toBe('0.0ms (0 μs)');
	});

	it('toggles model pills while preventing deselection of the last active model', () => {
		const store = createBenchmarksStore();
		expect(store.selectedModelIds).toEqual(['qwen-2.5-72b', 'llama-3.3-70b']);

		store.toggleModel('claude-3.5-sonnet');
		expect(store.selectedModelIds).toEqual(['qwen-2.5-72b', 'llama-3.3-70b', 'claude-3.5-sonnet']);

		store.toggleModel('qwen-2.5-72b');
		store.toggleModel('claude-3.5-sonnet');
		expect(store.selectedModelIds).toEqual(['llama-3.3-70b']);

		// Cannot deselect the final remaining model
		store.toggleModel('llama-3.3-70b');
		expect(store.selectedModelIds).toEqual(['llama-3.3-70b']);
	});

	it('filters prompts by category tab', () => {
		const store = createBenchmarksStore();
		expect(store.filteredPrompts.length).toBe(4);

		store.setCategory('sla-triage');
		expect(store.filteredPrompts).toHaveLength(1);
		expect(store.filteredPrompts[0]?.category).toBe('sla-triage');

		store.setCategory('hitl-guardrails');
		expect(store.filteredPrompts).toHaveLength(1);
		expect(store.filteredPrompts[0]?.toolName).toBe('hitl_issue_credit');

		store.setCategory('all');
		expect(store.filteredPrompts).toHaveLength(4);
	});

	it('preempts and aborts in-flight AbortController on re-run and reset()', async () => {
		const store = createBenchmarksStore();
		const capturedSignals: AbortSignal[] = [];

		const hangingFetcher: typeof fetch = vi.fn((_input, init) => {
			if (init?.signal) {
				capturedSignals.push(init.signal);
			}
			return new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => {
					const err = new Error('Aborted');
					err.name = 'AbortError';
					reject(err);
				});
			});
		});

		const firstRun = store.runBenchmarkSuite({ token: 'jwt-123', fetcher: hangingFetcher });
		expect(store.status).toBe('running');
		expect(capturedSignals).toHaveLength(1);
		expect(capturedSignals[0]?.aborted).toBe(false);

		// Re-running preempts and aborts the first AbortController
		const secondRun = store.runBenchmarkSuite({ token: 'jwt-123', fetcher: hangingFetcher });
		expect(capturedSignals[0]?.aborted).toBe(true);
		expect(capturedSignals).toHaveLength(2);
		expect(capturedSignals[1]?.aborted).toBe(false);

		// reset() aborts the second AbortController and restores defaults
		store.reset();
		expect(capturedSignals[1]?.aborted).toBe(true);
		expect(store.status).toBe('idle');
		expect(store.terminalLines).toEqual([]);

		await Promise.all([firstRun, secondRun]);
	});

	it('completes deterministic local fallback when backend is offline', async () => {
		const store = createBenchmarksStore();
		const offlineFetcher: typeof fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

		await store.runBenchmarkSuite({
			token: 'jwt-offline',
			fetcher: offlineFetcher,
			stepDelayMs: 5
		});

		expect(store.status).toBe('completed');
		expect(store.terminalLines.length).toBeGreaterThan(0);
		expect(store.toolValidation.status).toBe('PASS');
	});

	it('executes DataFusion SQL comparative queries over delta/llm_benchmarks/ in < 3ms', () => {
		const store = createBenchmarksStore();
		expect(store.sqlResult.sourcePath).toBe(DELTA_LLM_BENCHMARKS_SOURCE);
		expect(store.sqlResult.executionMs).toBeLessThan(3);
		expect(store.sqlResult.rows.length).toBe(4);

		const filtered = store.executeSqlQuery(
			"SELECT model_id, ROUND(AVG(ttft_ms), 2) AS avg_ttft_ms FROM delta.llm_benchmarks WHERE model_id = 'qwen-2.5-72b' GROUP BY model_id;"
		);
		expect(filtered.error).toBeNull();
		expect(filtered.executionMs).toBeLessThan(3);
		expect(filtered.rows).toHaveLength(1);
		expect(filtered.rows[0]?.model_id).toBe('qwen-2.5-72b');

		const invalid = store.executeSqlQuery('SELECT * FROM unknown_table');
		expect(invalid.error).toContain('delta.llm_benchmarks');

		const nonSelect = store.executeSqlQuery('DROP TABLE delta.llm_benchmarks');
		expect(nonSelect.error).toContain('SELECT');

		const emptyResult = store.executeSqlQuery(
			"SELECT model_id FROM delta.llm_benchmarks WHERE model_id = 'unknown';"
		);
		expect(emptyResult.error).toBeNull();
		expect(emptyResult.rows).toEqual([]);
	});

	it('streams live fetch SSE with CRLF framing, multi-line data:, telemetry normalization, and EOF flush', async () => {
		const store = createBenchmarksStore();
		const encoder = new TextEncoder();

		const sseBody = new ReadableStream<Uint8Array>({
			start(controller) {
				// Event 1: CRLF framing + multi-line data:
				controller.enqueue(
					encoder.encode(
						'data: {"modelId":"qwen-2.5-72b",\r\n' +
							'data: "level":"ttft","ttftMs":145.5,"text":"[TTFT] qwen-2.5-72b 145.5ms"}\r\n\r\n'
					)
				);
				// Event 2: BenchmarkTelemetryItem shape + negative ttftMs ignored
				controller.enqueue(
					encoder.encode(
						'data: {"model_id":"llama-3.3-70b","ttft_micros":190000,"tps":135.2}\r\n\r\n' +
							'data: {"modelId":"system","level":"info","ttftMs":-10,"text":"ignored negative"}\r\n\r\n'
					)
				);
				// Event 3: EOF without trailing delimiter
				controller.enqueue(
					encoder.encode('data: {"modelId":"system","level":"done","text":"[DONE] live stream"}')
				);
				controller.close();
			}
		});

		const liveFetcher: typeof fetch = vi.fn(async (input) => {
			const url = String(input);
			if (url === '/api/v1/benchmarks/run') {
				return new Response(JSON.stringify({ run_id: 'run/live 1' }), { status: 200 });
			}
			if (url === '/api/v1/benchmarks/run%2Flive%201/stream') {
				return new Response(sseBody, {
					status: 200,
					headers: { 'Content-Type': 'text/event-stream' }
				});
			}
			return new Response(null, { status: 404 });
		});

		await store.runBenchmarkSuite({ token: 'jwt-live', fetcher: liveFetcher });

		expect(store.status).toBe('completed');
		expect(store.activeRunId).toBe('run/live 1');
		expect(store.latestTtftMs).toBe(190);
		expect(store.terminalLines.map((l) => l.text)).toEqual([
			'[TTFT] qwen-2.5-72b 145.5ms',
			'[TTFT] llama-3.3-70b -> 190.0ms (190,000 μs) · 135.2 tok/s',
			'ignored negative',
			'[DONE] live stream'
		]);
	});

	it('abortRun() cancels a live SSE stream cleanly', async () => {
		const store = createBenchmarksStore();
		const encoder = new TextEncoder();
		let cancelCalled = false;

		const sseBody = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(
					encoder.encode('data: {"modelId":"system","level":"info","text":"started"}\n\n')
				);
			},
			cancel() {
				cancelCalled = true;
			}
		});

		const liveFetcher: typeof fetch = vi.fn(async (input) => {
			const url = String(input);
			if (url === '/api/v1/benchmarks/run') {
				return new Response(JSON.stringify({ run_id: 'run-abort-1' }), { status: 200 });
			}
			return new Response(sseBody, { status: 200 });
		});

		const runPromise = store.runBenchmarkSuite({ token: 'jwt-live', fetcher: liveFetcher });
		await vi.waitFor(() => {
			expect(store.terminalLines.some((l) => l.text === 'started')).toBe(true);
		});

		store.abortRun();
		await runPromise;

		expect(cancelCalled).toBe(true);
		expect(store.status).toBe('aborted');
		expect(store.terminalLines.at(-1)?.text).toBe('[ABORT] Benchmark run cancelled by operator.');
	});

	it('sets error status on 401/403/500 responses instead of falling back to simulation', async () => {
		const store = createBenchmarksStore();
		const unauthorizedFetcher: typeof fetch = vi.fn(async () => new Response(null, { status: 401 }));

		await store.runBenchmarkSuite({ token: 'bad-jwt', fetcher: unauthorizedFetcher });
		expect(store.status).toBe('error');
		expect(store.errorMessage).toContain('401');
	});
});
