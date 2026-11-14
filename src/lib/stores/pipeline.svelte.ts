import { Subject, throttleTime, type Subscription } from 'rxjs';

export type PipelineStageId = 'stream-replay-rs' | 'apache-iggy' | 'arroyo' | 'delta-lake';

export type PipelineConnectionStatus =
	| 'idle'
	| 'connecting'
	| 'live'
	| 'completed'
	| 'disconnected'
	| 'error';

export interface PipelineCounters {
	eventsEmitted: number;
	iggyOffset: number;
	arroyoProcessed: number;
	deltaRows: number;
}

export interface StageLatencyPercentiles {
	p50Ms: number;
	p95Ms: number;
	p99Ms: number;
}

export interface PipelineStageMetric {
	id: PipelineStageId;
	name: string;
	healthPill: string;
	subtitle: string;
	latency: StageLatencyPercentiles;
}

export interface DeltaTablePartitionCount {
	table: 'olist_orders' | 'olist_order_items' | 'olist_order_reviews' | 'olist_customers';
	partitions: number;
}

export interface PipelineTelemetrySample extends Partial<PipelineCounters> {
	stage?: PipelineStageId | 'system';
	level?: 'info' | 'metric' | 'checkpoint' | 'error';
	text?: string;
	replayMsgsPerSec?: number;
	iggyFsyncMs?: number;
	arroyoWatermarkLagSec?: number;
	deltaCommitLogMs?: number;
	consumerGroupLag?: number;
	iggyCommitted?: number;
}

export interface PipelineTerminalLine {
	id: string;
	timestamp: string;
	stage: PipelineStageId | 'system';
	level: 'info' | 'metric' | 'checkpoint' | 'error';
	text: string;
}

export interface ConnectTelemetryOptions {
	token?: string | null;
	fetcher?: typeof fetch;
	stepDelayMs?: number;
}

export const MAX_TERMINAL_LINES = 2000;

export const PIPELINE_TOPIC = 'olist/orders_stream';
export const PIPELINE_STREAM_SERVICE = 'ferrous-streaming';
export const PIPELINE_ARROYO_LABEL = 'Olist Arroyo pipeline';
export const PIPELINE_CONSUMER_GROUP = 'cg-arroyo-olist';

export const DEFAULT_DELTA_PARTITIONS: DeltaTablePartitionCount[] = [
	{ table: 'olist_orders', partitions: 16 },
	{ table: 'olist_order_items', partitions: 16 },
	{ table: 'olist_order_reviews', partitions: 12 },
	{ table: 'olist_customers', partitions: 8 }
];

export const DEFAULT_PIPELINE_COUNTERS: PipelineCounters = {
	eventsEmitted: 99441,
	iggyOffset: 99441,
	arroyoProcessed: 99441,
	deltaRows: 99441
};

export function generateFallbackTelemetrySamples(
	baseEmitted: number = DEFAULT_PIPELINE_COUNTERS.eventsEmitted
): PipelineTelemetrySample[] {
	return [
		{
			stage: 'stream-replay-rs',
			level: 'info',
			eventsEmitted: baseEmitted + 25,
			replayMsgsPerSec: 24.8,
			text: `[stream-replay-rs] Streaming ${PIPELINE_TOPIC} @ 24.8 msgs/s (emitted=${baseEmitted + 25})`
		},
		{
			stage: 'apache-iggy',
			level: 'metric',
			eventsEmitted: baseEmitted + 25,
			iggyOffset: baseEmitted + 25,
			iggyCommitted: baseEmitted + 25,
			iggyFsyncMs: 0.38,
			text: `[Apache Iggy] ${PIPELINE_STREAM_SERVICE} WAL fsync 0.38ms · offset=${baseEmitted + 25}`
		},
		{
			stage: 'arroyo',
			level: 'metric',
			eventsEmitted: baseEmitted + 25,
			iggyOffset: baseEmitted + 25,
			arroyoProcessed: baseEmitted + 25,
			arroyoWatermarkLagSec: 0.12,
			consumerGroupLag: 0,
			text: `[Arroyo] ${PIPELINE_ARROYO_LABEL} (${PIPELINE_CONSUMER_GROUP}) lag=0 msgs · watermark=0.12s`
		},
		{
			stage: 'delta-lake',
			level: 'checkpoint',
			eventsEmitted: baseEmitted + 25,
			iggyOffset: baseEmitted + 25,
			arroyoProcessed: baseEmitted + 25,
			deltaRows: baseEmitted + 25,
			deltaCommitLogMs: 1.8,
			text: `[Delta Lake] ACID commit log 1.8ms · deltaRows=${baseEmitted + 25} (olist_orders=16p)`
		}
	];
}

function isValidCount(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidMetric(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Enforces monotonic counter progression and pipeline conservation invariants:
 * - Each counter is monotonic: next >= prev
 * - Conservation across stages: deltaRows <= arroyoProcessed <= iggyOffset <= eventsEmitted
 */
export function applyPipelineSample(
	sample: Partial<PipelineCounters>,
	prev: PipelineCounters = DEFAULT_PIPELINE_COUNTERS
): PipelineCounters {
	const safePrev: PipelineCounters = {
		eventsEmitted: isValidCount(prev?.eventsEmitted)
			? Math.floor(prev.eventsEmitted)
			: DEFAULT_PIPELINE_COUNTERS.eventsEmitted,
		iggyOffset: isValidCount(prev?.iggyOffset)
			? Math.floor(prev.iggyOffset)
			: DEFAULT_PIPELINE_COUNTERS.iggyOffset,
		arroyoProcessed: isValidCount(prev?.arroyoProcessed)
			? Math.floor(prev.arroyoProcessed)
			: DEFAULT_PIPELINE_COUNTERS.arroyoProcessed,
		deltaRows: isValidCount(prev?.deltaRows)
			? Math.floor(prev.deltaRows)
			: DEFAULT_PIPELINE_COUNTERS.deltaRows
	};

	const rawEmitted = isValidCount(sample?.eventsEmitted)
		? Math.floor(sample.eventsEmitted)
		: safePrev.eventsEmitted;
	const rawIggy = isValidCount(sample?.iggyOffset)
		? Math.floor(sample.iggyOffset)
		: safePrev.iggyOffset;
	const rawArroyo = isValidCount(sample?.arroyoProcessed)
		? Math.floor(sample.arroyoProcessed)
		: safePrev.arroyoProcessed;
	const rawDelta = isValidCount(sample?.deltaRows)
		? Math.floor(sample.deltaRows)
		: safePrev.deltaRows;

	const eventsEmitted = Math.max(safePrev.eventsEmitted, rawEmitted);
	const iggyOffset = Math.min(eventsEmitted, Math.max(safePrev.iggyOffset, rawIggy));
	const arroyoProcessed = Math.min(iggyOffset, Math.max(safePrev.arroyoProcessed, rawArroyo));
	const deltaRows = Math.min(arroyoProcessed, Math.max(safePrev.deltaRows, rawDelta));

	return {
		eventsEmitted,
		iggyOffset,
		arroyoProcessed,
		deltaRows
	};
}

export function createPipelineStore() {
	let status = $state<PipelineConnectionStatus>('idle');
	let errorMessage = $state<string | null>(null);
	let counters = $state<PipelineCounters>({ ...DEFAULT_PIPELINE_COUNTERS });
	let iggyCommitted = $state<number>(DEFAULT_PIPELINE_COUNTERS.iggyOffset);
	let replayMsgsPerSec = $state<number>(24.8);
	let iggyFsyncMs = $state<number>(0.38);
	let arroyoWatermarkLagSec = $state<number>(0.12);
	let deltaCommitLogMs = $state<number>(1.8);
	let consumerGroupLag = $state<number>(0);
	let deltaPartitions = $state<DeltaTablePartitionCount[]>(
		DEFAULT_DELTA_PARTITIONS.map((item) => ({ ...item }))
	);
	let terminalLines = $state<PipelineTerminalLine[]>([]);

	let activeController: AbortController | null = null;
	let activeTimers = new Set<ReturnType<typeof setTimeout>>();
	let streamSubscription: Subscription | null = null;
	let chunkSubject: Subject<void> | null = null;
	let pendingSamples: PipelineTelemetrySample[] = [];
	let lineSeq = 0;

	const stages = $derived<PipelineStageMetric[]>([
		{
			id: 'stream-replay-rs',
			name: 'stream-replay-rs',
			healthPill: `${replayMsgsPerSec.toFixed(1)} msgs/s`,
			subtitle: `Topic: ${PIPELINE_TOPIC}`,
			latency: { p50Ms: 1.4, p95Ms: 2.9, p99Ms: 4.6 }
		},
		{
			id: 'apache-iggy',
			name: 'Apache Iggy',
			healthPill: `${iggyFsyncMs.toFixed(2)}ms fsync`,
			subtitle: PIPELINE_STREAM_SERVICE,
			latency: { p50Ms: 0.38, p95Ms: 0.72, p99Ms: 1.15 }
		},
		{
			id: 'arroyo',
			name: 'Arroyo',
			healthPill: `${arroyoWatermarkLagSec.toFixed(2)}s watermark lag`,
			subtitle: PIPELINE_ARROYO_LABEL,
			latency: { p50Ms: 8.2, p95Ms: 16.4, p99Ms: 28.0 }
		},
		{
			id: 'delta-lake',
			name: 'Delta Lake',
			healthPill: `${deltaCommitLogMs.toFixed(1)}ms commit log`,
			subtitle: 'ACID Checkpoint Sink',
			latency: { p50Ms: 1.8, p95Ms: 3.4, p99Ms: 5.9 }
		}
	]);

	function clearTimers() {
		for (const timer of activeTimers) {
			clearTimeout(timer);
		}
		activeTimers.clear();
	}

	function teardownStreamPipeline() {
		clearTimers();
		if (streamSubscription) {
			streamSubscription.unsubscribe();
			streamSubscription = null;
		}
		if (chunkSubject) {
			chunkSubject.complete();
			chunkSubject = null;
		}
		pendingSamples = [];
	}

	function applySampleState(sample: PipelineTelemetrySample): PipelineTerminalLine | null {
		const nextCounters = applyPipelineSample(sample, counters);
		counters = nextCounters;

		if (isValidCount(sample.iggyCommitted)) {
			iggyCommitted = Math.min(
				nextCounters.iggyOffset,
				Math.max(iggyCommitted, Math.floor(sample.iggyCommitted))
			);
		} else {
			iggyCommitted = Math.min(nextCounters.iggyOffset, iggyCommitted);
		}

		if (isValidMetric(sample.replayMsgsPerSec)) {
			replayMsgsPerSec = sample.replayMsgsPerSec;
		}
		if (isValidMetric(sample.iggyFsyncMs)) {
			iggyFsyncMs = sample.iggyFsyncMs;
		}
		if (isValidMetric(sample.arroyoWatermarkLagSec)) {
			arroyoWatermarkLagSec = sample.arroyoWatermarkLagSec;
		}
		if (isValidMetric(sample.deltaCommitLogMs)) {
			deltaCommitLogMs = sample.deltaCommitLogMs;
		}
		if (isValidCount(sample.consumerGroupLag)) {
			consumerGroupLag = Math.floor(sample.consumerGroupLag);
		} else {
			consumerGroupLag = Math.max(0, nextCounters.iggyOffset - nextCounters.arroyoProcessed);
		}

		if (sample.text) {
			lineSeq += 1;
			return {
				id: `pl-line-${lineSeq}`,
				timestamp: new Date().toISOString().slice(11, 23),
				stage: sample.stage ?? 'system',
				level: sample.level ?? 'info',
				text: sample.text
			};
		}

		return null;
	}

	function flushPendingSamples() {
		if (pendingSamples.length === 0) {
			return;
		}
		const batch = pendingSamples;
		pendingSamples = [];

		const newLines: PipelineTerminalLine[] = [];
		for (const sample of batch) {
			const line = applySampleState(sample);
			if (line) {
				newLines.push(line);
			}
		}

		if (newLines.length > 0) {
			terminalLines = [...terminalLines, ...newLines].slice(-MAX_TERMINAL_LINES);
		}
	}

	function initStreamPipeline() {
		teardownStreamPipeline();
		const subject = new Subject<void>();
		chunkSubject = subject;
		streamSubscription = subject
			.pipe(throttleTime(16, undefined, { leading: true, trailing: true }))
			.subscribe(() => {
				flushPendingSamples();
			});
	}

	function pushSample(sample: PipelineTelemetrySample) {
		pendingSamples.push(sample);
		chunkSubject?.next();
	}

	function abortActiveController() {
		if (activeController) {
			activeController.abort();
			activeController = null;
		}
		teardownStreamPipeline();
	}

	async function consumeSseStream(response: Response, signal: AbortSignal): Promise<boolean> {
		if (!response.body) {
			return false;
		}
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		const onAbort = () => {
			void reader.cancel().catch(() => {});
		};
		signal.addEventListener('abort', onAbort, { once: true });

		const normalizePayload = (
			parsed: Record<string, unknown>,
			rawText: string
		): PipelineTelemetrySample => {
			const validStages = new Set(['stream-replay-rs', 'apache-iggy', 'arroyo', 'delta-lake', 'system']);
			const stage = (
				typeof parsed.stage === 'string' && validStages.has(parsed.stage) ? parsed.stage : 'system'
			) as PipelineTelemetrySample['stage'];

			const validLevels = new Set(['info', 'metric', 'checkpoint', 'error']);
			const level = (
				typeof parsed.level === 'string' && validLevels.has(parsed.level) ? parsed.level : 'metric'
			) as PipelineTelemetrySample['level'];

			const rawHighWatermark =
				typeof parsed.olist_high_watermark === 'number'
					? parsed.olist_high_watermark
					: undefined;

			const eventsEmitted =
				typeof parsed.eventsEmitted === 'number'
					? parsed.eventsEmitted
					: typeof parsed.events_emitted === 'number'
						? parsed.events_emitted
						: rawHighWatermark;

			const iggyOffset =
				typeof parsed.iggyOffset === 'number'
					? parsed.iggyOffset
					: typeof parsed.iggy_offset === 'number'
						? parsed.iggy_offset
						: rawHighWatermark;

			const consumerGroupLagVal =
				typeof parsed.consumerGroupLag === 'number'
					? parsed.consumerGroupLag
					: typeof parsed.consumer_group_lag === 'number'
						? parsed.consumer_group_lag
						: typeof parsed.olist_consumer_lag === 'number'
							? parsed.olist_consumer_lag
							: undefined;

			const arroyoProcessed =
				typeof parsed.arroyoProcessed === 'number'
					? parsed.arroyoProcessed
					: typeof parsed.arroyo_processed === 'number'
						? parsed.arroyo_processed
						: rawHighWatermark !== undefined && consumerGroupLagVal !== undefined
							? Math.max(0, rawHighWatermark - consumerGroupLagVal)
							: undefined;

			const deltaRows =
				typeof parsed.deltaRows === 'number'
					? parsed.deltaRows
					: typeof parsed.delta_rows === 'number'
						? parsed.delta_rows
						: typeof parsed.delta_commit_count === 'number'
							? parsed.delta_commit_count
							: undefined;

			const iggyCommitLagVal =
				typeof parsed.iggy_commit_lag === 'number'
					? parsed.iggy_commit_lag
					: undefined;

			const iggyCommittedVal =
				typeof parsed.iggyCommitted === 'number'
					? parsed.iggyCommitted
					: typeof parsed.iggy_committed === 'number'
						? parsed.iggy_committed
						: rawHighWatermark !== undefined && iggyCommitLagVal !== undefined
							? Math.max(0, rawHighWatermark - iggyCommitLagVal)
							: undefined;

			const replayMsgsPerSecVal =
				typeof parsed.replayMsgsPerSec === 'number'
					? parsed.replayMsgsPerSec
					: typeof parsed.replay_msgs_per_sec === 'number'
						? parsed.replay_msgs_per_sec
						: typeof parsed.olist_replay_rate_eps === 'number'
							? parsed.olist_replay_rate_eps
							: undefined;

			const iggyFsyncMsVal =
				typeof parsed.iggyFsyncMs === 'number'
					? parsed.iggyFsyncMs
					: typeof parsed.iggy_fsync_ms === 'number'
						? parsed.iggy_fsync_ms
						: typeof parsed.iggy_fsync_latency_us === 'number'
							? parsed.iggy_fsync_latency_us / 1000
							: undefined;

			const arroyoWatermarkLagSecVal =
				typeof parsed.arroyoWatermarkLagSec === 'number'
					? parsed.arroyoWatermarkLagSec
					: typeof parsed.arroyo_watermark_lag_sec === 'number'
						? parsed.arroyo_watermark_lag_sec
						: typeof parsed.arroyo_watermark_lag_ms === 'number'
							? parsed.arroyo_watermark_lag_ms / 1000
							: undefined;

			const deltaCommitLogMsVal =
				typeof parsed.deltaCommitLogMs === 'number'
					? parsed.deltaCommitLogMs
					: typeof parsed.delta_commit_log_ms === 'number'
						? parsed.delta_commit_log_ms
						: undefined;

			let text: string;
			if (typeof parsed.text === 'string') {
				text = parsed.text;
			} else if (typeof parsed.message === 'string') {
				text = parsed.message;
			} else if (
				rawHighWatermark !== undefined ||
				typeof parsed.delta_commit_count === 'number' ||
				typeof parsed.olist_replay_rate_eps === 'number' ||
				typeof parsed.iggy_fsync_latency_us === 'number' ||
				typeof parsed.arroyo_watermark_lag_ms === 'number' ||
				typeof parsed.olist_consumer_lag === 'number'
			) {
				const metrics: string[] = [];
				if (rawHighWatermark !== undefined) metrics.push(`high_watermark=${rawHighWatermark}`);
				if (replayMsgsPerSecVal !== undefined) metrics.push(`replay=${replayMsgsPerSecVal.toFixed(1)} eps`);
				if (iggyFsyncMsVal !== undefined) metrics.push(`fsync=${iggyFsyncMsVal.toFixed(2)}ms`);
				if (arroyoWatermarkLagSecVal !== undefined) metrics.push(`watermark_lag=${arroyoWatermarkLagSecVal.toFixed(2)}s`);
				if (consumerGroupLagVal !== undefined) metrics.push(`consumer_lag=${consumerGroupLagVal}`);
				if (deltaRows !== undefined) metrics.push(`delta_commits=${deltaRows}`);
				text = `[pipeline-telemetry] ${metrics.join(' · ')}`;
			} else {
				text = `[${stage}] ${rawText}`;
			}

			return {
				stage,
				level,
				text,
				eventsEmitted,
				iggyOffset,
				arroyoProcessed,
				deltaRows,
				iggyCommitted: iggyCommittedVal,
				replayMsgsPerSec: replayMsgsPerSecVal,
				iggyFsyncMs: iggyFsyncMsVal,
				arroyoWatermarkLagSec: arroyoWatermarkLagSecVal,
				deltaCommitLogMs: deltaCommitLogMsVal,
				consumerGroupLag: consumerGroupLagVal
			};
		};

		const processSseEvent = (rawEvent: string) => {
			const lines = rawEvent.split(/\r?\n/);
			let eventType = '';
			const dataLines: string[] = [];

			for (const line of lines) {
				if (line.startsWith('event:')) {
					eventType = line.slice(6).trim();
				} else if (line.startsWith('data:')) {
					dataLines.push(line.slice(5).replace(/^ /, ''));
				}
			}

			if (dataLines.length === 0) return;
			const payloadText = dataLines.join('\n').trim();
			if (!payloadText || payloadText === '[DONE]') return;

			if (eventType === 'error') {
				let msg = payloadText;
				try {
					const errObj = JSON.parse(payloadText);
					if (typeof errObj === 'object' && errObj !== null) {
						const rec = errObj as Record<string, unknown>;
						msg =
							typeof rec.message === 'string'
								? rec.message
								: typeof rec.error === 'string'
									? rec.error
									: payloadText;
					}
				} catch {
					// Fall back to plain-text error
				}
				status = 'error';
				errorMessage = msg;
				pushSample({
					stage: 'system',
					level: 'error',
					text: `[error] ${msg}`
				});
				return;
			}

			try {
				const parsed: unknown = JSON.parse(payloadText);
				if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
					const rec = parsed as Record<string, unknown>;
					if (rec.status === 'error' || rec.error) {
						const errMsg =
							typeof rec.error === 'string'
								? rec.error
								: typeof rec.message === 'string'
									? rec.message
									: 'Pipeline telemetry reported an error';
						status = 'error';
						errorMessage = errMsg;
						pushSample({
							stage: 'system',
							level: 'error',
							text: `[error] ${errMsg}`
						});
						return;
					}
					pushSample(normalizePayload(rec, payloadText));
					return;
				}
			} catch {
				// Fall back to plain-text SSE event payload.
			}

			pushSample({
				stage: 'system',
				level: 'info',
				text: payloadText
			});
		};

		try {
			while (!signal.aborted) {
				const { done, value } = await reader.read();
				if (done) {
					buffer += decoder.decode();
					break;
				}
				buffer += decoder.decode(value, { stream: true });
				const events = buffer.split(/\r?\n\r?\n/);
				buffer = events.pop() ?? '';

				for (const rawEvent of events) {
					processSseEvent(rawEvent);
				}
			}

			if (!signal.aborted && buffer.trim()) {
				for (const rawEvent of buffer.split(/\r?\n\r?\n/)) {
					if (rawEvent.trim()) {
						processSseEvent(rawEvent);
					}
				}
			}

			if (!signal.aborted) {
				flushPendingSamples();
			}
			return !signal.aborted && status !== 'error';
		} finally {
			signal.removeEventListener('abort', onAbort);
			try {
				await reader.cancel().catch(() => {});
			} catch {
				// Ignore already-closed or cancelled reader.
			}
			try {
				reader.releaseLock();
			} catch {
				// Ignore already-released reader locks.
			}
		}
	}

	function runLocalTelemetryFallback(
		controller: AbortController,
		stepDelayMs: number
	): Promise<void> {
		status = 'live';
		const samples = generateFallbackTelemetrySamples(counters.eventsEmitted);

		return new Promise<void>((resolve) => {
			if (controller.signal.aborted || activeController !== controller) {
				resolve();
				return;
			}

			let idx = 0;
			const onAbort = () => {
				clearTimers();
				resolve();
			};
			controller.signal.addEventListener('abort', onAbort, { once: true });

			const finishFallback = () => {
				controller.signal.removeEventListener('abort', onAbort);
				if (controller.signal.aborted || activeController !== controller) {
					resolve();
					return;
				}
				flushPendingSamples();
				teardownStreamPipeline();
				status = 'completed';
				if (activeController === controller) {
					activeController = null;
				}
				resolve();
			};

			const scheduleNext = () => {
				if (controller.signal.aborted || activeController !== controller) {
					controller.signal.removeEventListener('abort', onAbort);
					resolve();
					return;
				}
				if (idx >= samples.length) {
					finishFallback();
					return;
				}

				const sample = samples[idx];
				idx += 1;
				pushSample(sample);

				if (idx >= samples.length) {
					finishFallback();
					return;
				}

				const timer = setTimeout(() => {
					activeTimers.delete(timer);
					if (controller.signal.aborted || activeController !== controller) {
						controller.signal.removeEventListener('abort', onAbort);
						resolve();
						return;
					}
					scheduleNext();
				}, stepDelayMs);
				activeTimers.add(timer);
			};

			const initialTimer = setTimeout(() => {
				activeTimers.delete(initialTimer);
				if (controller.signal.aborted || activeController !== controller) {
					controller.signal.removeEventListener('abort', onAbort);
					resolve();
					return;
				}
				scheduleNext();
			}, stepDelayMs);
			activeTimers.add(initialTimer);
		});
	}

	return {
		get status() {
			return status;
		},
		get errorMessage() {
			return errorMessage;
		},
		get counters() {
			return counters;
		},
		get iggyCommitted() {
			return iggyCommitted;
		},
		get replayMsgsPerSec() {
			return replayMsgsPerSec;
		},
		get iggyFsyncMs() {
			return iggyFsyncMs;
		},
		get arroyoWatermarkLagSec() {
			return arroyoWatermarkLagSec;
		},
		get deltaCommitLogMs() {
			return deltaCommitLogMs;
		},
		get consumerGroupLag() {
			return consumerGroupLag;
		},
		get deltaPartitions() {
			return deltaPartitions;
		},
		get stages() {
			return stages;
		},
		get terminalLines() {
			return terminalLines;
		},

		applyPipelineSample(sample: PipelineTelemetrySample): PipelineCounters {
			const line = applySampleState(sample);
			if (line) {
				terminalLines = [...terminalLines, line].slice(-MAX_TERMINAL_LINES);
			}
			return counters;
		},

		async connectTelemetryStream(options: ConnectTelemetryOptions = {}): Promise<void> {
			abortActiveController();

			const controller = new AbortController();
			activeController = controller;
			status = 'connecting';
			errorMessage = null;
			initStreamPipeline();

			const fetcher =
				options.fetcher ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch : null);
			const headers: Record<string, string> = {};
			if (options.token) {
				headers.Authorization = `Bearer ${options.token}`;
			}

			if (fetcher) {
				try {
					const res = await fetcher('/api/v1/telemetry/pipeline/stream', {
						method: 'GET',
						headers,
						signal: controller.signal
					});

					if (controller.signal.aborted || activeController !== controller) {
						return;
					}

					if (res.status === 401 || res.status === 403 || res.status >= 500) {
						teardownStreamPipeline();
						status = 'error';
						errorMessage = `Pipeline telemetry stream error (${res.status})`;
						activeController = null;
						return;
					}

					if (res.ok) {
						status = 'live';
						const completed = await consumeSseStream(res, controller.signal);
						if (completed) {
							teardownStreamPipeline();
							if (!controller.signal.aborted) {
								status = 'completed';
								if (activeController === controller) {
									activeController = null;
								}
							}
							return;
						}

						if (!controller.signal.aborted && activeController === controller) {
							teardownStreamPipeline();
							if ((status as PipelineConnectionStatus) !== 'error') {
								status = 'error';
								errorMessage = 'Pipeline telemetry stream disconnected unexpectedly';
							}
							activeController = null;
							return;
						}
					}
				} catch (err) {
					if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
						return;
					}
					if (status === 'live') {
						teardownStreamPipeline();
						status = 'error';
						errorMessage =
							err instanceof Error
								? `Pipeline telemetry stream disconnected: ${err.message}`
								: 'Pipeline telemetry stream disconnected unexpectedly';
						if (activeController === controller) {
							activeController = null;
						}
						return;
					}
					// Offline or 404 fallback to deterministic local telemetry ticks.
				}
			}

			if (controller.signal.aborted || activeController !== controller) {
				return;
			}
			if (status === 'live' || status === 'error') {
				return;
			}

			await runLocalTelemetryFallback(controller, options.stepDelayMs ?? 25);
		},

		disconnect() {
			const wasActive = Boolean(activeController) || status === 'connecting' || status === 'live';
			abortActiveController();
			if (wasActive) {
				status = 'disconnected';
			}
		},

		reset() {
			abortActiveController();
			status = 'idle';
			errorMessage = null;
			counters = { ...DEFAULT_PIPELINE_COUNTERS };
			iggyCommitted = DEFAULT_PIPELINE_COUNTERS.iggyOffset;
			replayMsgsPerSec = 24.8;
			iggyFsyncMs = 0.38;
			arroyoWatermarkLagSec = 0.12;
			deltaCommitLogMs = 1.8;
			consumerGroupLag = 0;
			deltaPartitions = DEFAULT_DELTA_PARTITIONS.map((item) => ({ ...item }));
			terminalLines = [];
		}
	};
}

export const pipelineStore = createPipelineStore();
