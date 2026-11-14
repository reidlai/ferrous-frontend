import { describe, expect, it, vi } from 'vitest';
import {
	applyPipelineSample,
	createPipelineStore,
	DEFAULT_PIPELINE_COUNTERS,
	generateFallbackTelemetrySamples,
	MAX_TERMINAL_LINES,
	PIPELINE_CONSUMER_GROUP,
	PIPELINE_STREAM_SERVICE,
	PIPELINE_TOPIC
} from './pipeline.svelte';

function createSseResponse(chunks: string[]): Response {
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		}
	});
	return new Response(stream, {
		status: 200,
		headers: { 'Content-Type': 'text/event-stream' }
	});
}

describe('Story 10.6: pipelineStore telemetry, invariants, and SSE stream', () => {
	it('enforces monotonic counter progression and pipeline conservation invariants', () => {
		const prev = {
			eventsEmitted: 1000,
			iggyOffset: 980,
			arroyoProcessed: 960,
			deltaRows: 940
		};

		// Attempt backward regression + downstream exceeding upstream
		const clamped = applyPipelineSample(
			{
				eventsEmitted: 900,
				iggyOffset: 1200,
				arroyoProcessed: 1150,
				deltaRows: 1100
			},
			prev
		);

		expect(clamped.eventsEmitted).toBe(1000);
		expect(clamped.iggyOffset).toBe(1000);
		expect(clamped.arroyoProcessed).toBe(1000);
		expect(clamped.deltaRows).toBe(1000);

		// Forward progression respecting conservation
		const next = applyPipelineSample(
			{
				eventsEmitted: 1050,
				iggyOffset: 1040,
				arroyoProcessed: 1030,
				deltaRows: 1020
			},
			clamped
		);
		expect(next).toEqual({
			eventsEmitted: 1050,
			iggyOffset: 1040,
			arroyoProcessed: 1030,
			deltaRows: 1020
		});
		expect(next.deltaRows <= next.arroyoProcessed).toBe(true);
		expect(next.arroyoProcessed <= next.iggyOffset).toBe(true);
		expect(next.iggyOffset <= next.eventsEmitted).toBe(true);
	});

	it('exposes 4-stage health pills, metadata labels, and Delta partition counts', () => {
		const store = createPipelineStore();
		const pills = store.stages.map((s) => s.healthPill);

		expect(pills).toEqual([
			'24.8 msgs/s',
			'0.38ms fsync',
			'0.12s watermark lag',
			'1.8ms commit log'
		]);
		expect(store.consumerGroupLag).toBe(0);
		expect(PIPELINE_TOPIC).toBe('olist/orders_stream');
		expect(PIPELINE_STREAM_SERVICE).toBe('ferrous-streaming');
		expect(PIPELINE_CONSUMER_GROUP).toBe('cg-arroyo-olist');
		expect(store.deltaPartitions).toEqual([
			{ table: 'olist_orders', partitions: 16 },
			{ table: 'olist_order_items', partitions: 16 },
			{ table: 'olist_order_reviews', partitions: 12 },
			{ table: 'olist_customers', partitions: 8 }
		]);
	});

	it('connects to GET /api/v1/telemetry/pipeline/stream with Bearer auth and CRLF SSE framing', async () => {
		const store = createPipelineStore();
		const sseChunks = [
			'data: {"stage":"stream-replay-rs","level":"metric","eventsEmitted":99500,"replayMsgsPerSec":24.8,\r\n' +
				'data: "text":"[stream-replay-rs] emitted 99500"}\r\n\r\n',
			'data: {"stage":"delta-lake","level":"checkpoint","iggyOffset":99500,"arroyoProcessed":99500,"deltaRows":99500,"deltaCommitLogMs":1.8,"text":"[Delta Lake] committed 99500"}\r\n\r\n'
		];

		const fetcher = vi.fn().mockResolvedValue(createSseResponse(sseChunks));

		await store.connectTelemetryStream({
			token: 'jwt-pipeline-token',
			fetcher: fetcher as unknown as typeof fetch
		});

		expect(fetcher).toHaveBeenCalledTimes(1);
		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe('/api/v1/telemetry/pipeline/stream');
		expect(init.method).toBe('GET');
		expect(init.headers).toEqual({ Authorization: 'Bearer jwt-pipeline-token' });
		expect(init.signal).toBeInstanceOf(AbortSignal);

		expect(store.status).toBe('completed');
		expect(store.counters.eventsEmitted).toBe(99500);
		expect(store.counters.deltaRows).toBe(99500);
		expect(store.terminalLines.length).toBe(2);
		expect(store.terminalLines[0].text).toBe('[stream-replay-rs] emitted 99500');
		expect(store.terminalLines[1].text).toBe('[Delta Lake] committed 99500');
	});

	it('sets error state on 401 without falling back to local telemetry', async () => {
		const store = createPipelineStore();
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));

		await store.connectTelemetryStream({
			token: 'expired-token',
			fetcher: fetcher as unknown as typeof fetch
		});

		expect(store.status).toBe('error');
		expect(store.errorMessage).toContain('401');
		expect(store.terminalLines).toHaveLength(0);
	});

	it('aborts in-flight fetch via AbortController on disconnect() and clears state on reset()', async () => {
		const store = createPipelineStore();
		let capturedSignal: AbortSignal | undefined;

		const fetcher = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
			capturedSignal = init.signal ?? undefined;
			return new Promise((_resolve, reject) => {
				init.signal?.addEventListener('abort', () => {
					const err = new Error('Aborted');
					err.name = 'AbortError';
					reject(err);
				});
			});
		});

		const pending = store.connectTelemetryStream({
			token: 'jwt-token',
			fetcher: fetcher as unknown as typeof fetch
		});

		expect(store.status).toBe('connecting');
		expect(capturedSignal?.aborted).toBe(false);

		store.disconnect();
		await pending;

		expect(capturedSignal?.aborted).toBe(true);
		expect(store.status).toBe('disconnected');

		store.applyPipelineSample({
			eventsEmitted: 100100,
			text: 'sample line'
		});
		expect(store.counters.eventsEmitted).toBe(100100);
		expect(store.terminalLines.length).toBe(1);

		store.reset();
		expect(store.status).toBe('idle');
		expect(store.counters).toEqual(DEFAULT_PIPELINE_COUNTERS);
		expect(store.terminalLines).toHaveLength(0);
		expect(store.errorMessage).toBeNull();
	});

	it('caps terminalLines at MAX_TERMINAL_LINES (2000)', async () => {
		const store = createPipelineStore();
		const events = Array.from({ length: MAX_TERMINAL_LINES + 25 }, (_, i) => {
			const count = DEFAULT_PIPELINE_COUNTERS.eventsEmitted + i;
			return `data: {"stage":"stream-replay-rs","level":"metric","eventsEmitted":${count},"text":"line-${i}"}\r\n\r\n`;
		}).join('');

		const fetcher = vi.fn().mockResolvedValue(createSseResponse([events]));
		await store.connectTelemetryStream({
			token: 'jwt-token',
			fetcher: fetcher as unknown as typeof fetch
		});

		expect(store.terminalLines.length).toBe(MAX_TERMINAL_LINES);
		expect(store.terminalLines[0].text).toBe('line-25');
		expect(store.terminalLines[MAX_TERMINAL_LINES - 1].text).toBe(
			`line-${MAX_TERMINAL_LINES + 24}`
		);
	});

	it('sets error state on 403, 500, and 503 stream responses', async () => {
		for (const statusCode of [403, 500, 503]) {
			const store = createPipelineStore();
			const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: statusCode }));
			await store.connectTelemetryStream({
				token: 'test-token',
				fetcher: fetcher as unknown as typeof fetch
			});
			expect(store.status).toBe('error');
			expect(store.errorMessage).toContain(String(statusCode));
			expect(store.terminalLines).toHaveLength(0);
		}
	});

	it('parses live backend PipelineTelemetryItem contract fields and formats human-readable terminal log', async () => {
		const store = createPipelineStore();
		const telemetryChunk = JSON.stringify({
			olist_high_watermark: 99550,
			iggy_commit_lag: 5,
			iggy_fsync_latency_us: 450,
			arroyo_watermark_lag_ms: 150,
			delta_commit_count: 99520,
			olist_replay_rate_eps: 32.5,
			olist_consumer_lag: 10,
			iggy_status: 'available',
			arroyo_status: 'available',
			delta_status: 'available'
		});
		const sseChunks = [`event: pipeline_telemetry\r\ndata: ${telemetryChunk}\r\n\r\n`];
		const fetcher = vi.fn().mockResolvedValue(createSseResponse(sseChunks));

		await store.connectTelemetryStream({
			token: 'jwt-pipeline-token',
			fetcher: fetcher as unknown as typeof fetch
		});

		expect(store.status).toBe('completed');
		expect(store.counters.eventsEmitted).toBe(99550);
		expect(store.counters.iggyOffset).toBe(99550);
		expect(store.counters.arroyoProcessed).toBe(99540); // 99550 - 10
		expect(store.counters.deltaRows).toBe(99520);
		expect(store.iggyCommitted).toBe(99545); // 99550 - 5
		expect(store.replayMsgsPerSec).toBe(32.5);
		expect(store.iggyFsyncMs).toBe(0.45); // 450us / 1000
		expect(store.arroyoWatermarkLagSec).toBe(0.15); // 150ms / 1000
		expect(store.consumerGroupLag).toBe(10);

		expect(store.terminalLines.length).toBe(1);
		const line = store.terminalLines[0].text;
		expect(line).toContain('high_watermark=99550');
		expect(line).toContain('replay=32.5 eps');
		expect(line).toContain('fsync=0.45ms');
		expect(line).toContain('watermark_lag=0.15s');
		expect(line).toContain('consumer_lag=10');
		expect(line).toContain('delta_commits=99520');
		// Must not dump raw JSON
		expect(line).not.toContain('{"');
	});

	it('tests fallback generator directly across 4 stages', () => {
		const samples = generateFallbackTelemetrySamples(1000);
		expect(samples).toHaveLength(4);
		expect(samples.map((s) => s.stage)).toEqual([
			'stream-replay-rs',
			'apache-iggy',
			'arroyo',
			'delta-lake'
		]);

		let current = { eventsEmitted: 1000, iggyOffset: 1000, arroyoProcessed: 1000, deltaRows: 1000 };
		for (const sample of samples) {
			current = applyPipelineSample(sample, current);
		}
		expect(current.eventsEmitted).toBe(1025);
		expect(current.iggyOffset).toBe(1025);
		expect(current.arroyoProcessed).toBe(1025);
		expect(current.deltaRows).toBe(1025);
	});

	it('executes local telemetry fallback across 4 stages when offline', async () => {
		const store = createPipelineStore();
		const fetcher = vi.fn().mockRejectedValue(new Error('Network offline'));
		await store.connectTelemetryStream({
			token: 'test-token',
			fetcher: fetcher as unknown as typeof fetch,
			stepDelayMs: 2
		});

		expect(store.status).toBe('completed');
		expect(store.counters.eventsEmitted).toBe(DEFAULT_PIPELINE_COUNTERS.eventsEmitted + 25);
		expect(store.counters.deltaRows).toBe(DEFAULT_PIPELINE_COUNTERS.deltaRows + 25);
		expect(store.terminalLines).toHaveLength(4);
		expect(store.terminalLines[0].stage).toBe('stream-replay-rs');
		expect(store.terminalLines[1].stage).toBe('apache-iggy');
		expect(store.terminalLines[2].stage).toBe('arroyo');
		expect(store.terminalLines[3].stage).toBe('delta-lake');
	});

	it('guards against NaN and negative values in applyPipelineSample for both sample and prev', () => {
		const prev = {
			eventsEmitted: 100,
			iggyOffset: 90,
			arroyoProcessed: 80,
			deltaRows: 70
		};

		const resultWithBadSample = applyPipelineSample(
			{
				eventsEmitted: NaN,
				iggyOffset: -10,
				arroyoProcessed: -999,
				deltaRows: NaN
			},
			prev
		);
		expect(resultWithBadSample).toEqual(prev);
		expect(Number.isNaN(resultWithBadSample.eventsEmitted)).toBe(false);

		// Malformed / NaN prev object
		const malformedPrev = {
			eventsEmitted: NaN,
			iggyOffset: -50,
			arroyoProcessed: -100,
			deltaRows: NaN
		};
		const resultWithBadPrev = applyPipelineSample(
			{ eventsEmitted: 150, iggyOffset: 140, arroyoProcessed: 130, deltaRows: 120 },
			malformedPrev as unknown as typeof DEFAULT_PIPELINE_COUNTERS
		);
		expect(Number.isNaN(resultWithBadPrev.eventsEmitted)).toBe(false);
		expect(resultWithBadPrev.eventsEmitted).toBeGreaterThanOrEqual(DEFAULT_PIPELINE_COUNTERS.eventsEmitted);
		expect(resultWithBadPrev.deltaRows <= resultWithBadPrev.arroyoProcessed).toBe(true);
		expect(resultWithBadPrev.arroyoProcessed <= resultWithBadPrev.iggyOffset).toBe(true);
		expect(resultWithBadPrev.iggyOffset <= resultWithBadPrev.eventsEmitted).toBe(true);
	});

	it('handles SSE event: error lines and error payloads', async () => {
		const store = createPipelineStore();
		const sseChunks = [
			'event: error\r\ndata: {"error":"Kafka stream broker unavailable"}\r\n\r\n'
		];
		const fetcher = vi.fn().mockResolvedValue(createSseResponse(sseChunks));
		await store.connectTelemetryStream({
			token: 'test-token',
			fetcher: fetcher as unknown as typeof fetch
		});
		expect(store.status).toBe('error');
		expect(store.errorMessage).toContain('Kafka stream broker unavailable');
	});

	it('does not fall back to local ticks when connection drops mid-stream after live status', async () => {
		const store = createPipelineStore();
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(
					encoder.encode('data: {"stage":"stream-replay-rs","eventsEmitted":99500}\r\n\r\n')
				);
				// Simulate abrupt connection drop / error
				controller.error(new Error('Connection reset by peer'));
			}
		});
		const fetcher = vi.fn().mockResolvedValue(
			new Response(stream, {
				status: 200,
				headers: { 'Content-Type': 'text/event-stream' }
			})
		);

		await store.connectTelemetryStream({
			token: 'test-token',
			fetcher: fetcher as unknown as typeof fetch,
			stepDelayMs: 2
		});

		expect(store.status).toBe('error');
		expect(store.errorMessage).toContain('disconnected');
		// Did NOT run local telemetry fallback to completed
		expect(store.status).not.toBe('completed');
	});
});
