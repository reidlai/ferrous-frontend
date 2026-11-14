/**
 * Shared RxJS Stream-to-Runes Reactive Bridge & Preempt-and-Abort Concurrency Manager
 *
 * Provides:
 * - Backpressure management via configurable RxJS throttleTime (default 16ms / ~60fps)
 * - Bounded terminal lines ring buffer (MAX_TERMINAL_LINES = 2000)
 * - Robust SSE parser handling CRLF (\r\n\r\n), comments, bare data lines, multi-line data, EOF buffer flush, and event: error
 * - Preempt-and-abort controller manager (<50ms abort propagation)
 */

import { Subject, type Subscription, throttleTime } from 'rxjs';

export interface SseBridgeOptions<T> {
	throttleMs?: number;
	maxLines?: number;
	onBatch?: (items: T[]) => void;
}

export class PreemptAbortManager {
	private currentController: AbortController | null = null;

	/**
	 * Creates a new AbortController after preemptively aborting any in-flight controller.
	 * Abort propagation happens synchronously in < 50ms.
	 */
	public spawn(): AbortController {
		this.abort();
		const controller = new AbortController();
		this.currentController = controller;
		return controller;
	}

	/**
	 * Immediately aborts the current in-flight controller, or a targeted controller.
	 * Clears this.currentController before invoking controller.abort() to prevent re-entrant null-out race.
	 */
	public abort(reasonOrTarget?: string | AbortController, maybeReason?: string): void {
		let reason: string | undefined;
		let target: AbortController | undefined;

		if (typeof reasonOrTarget === 'string' || reasonOrTarget === undefined) {
			reason = reasonOrTarget;
		} else if (reasonOrTarget instanceof AbortController) {
			target = reasonOrTarget;
			reason = maybeReason;
		}

		const controller = target ?? this.currentController;
		if (this.currentController === controller) {
			this.currentController = null;
		}
		if (controller && !controller.signal.aborted) {
			controller.abort(reason ?? 'Preempted');
		}
	}

	/**
	 * Releases tracking of a controller without aborting (e.g. normal completion).
	 */
	public release(controller?: AbortController): void {
		if (!controller || this.currentController === controller) {
			this.currentController = null;
		}
	}

	public get active(): AbortController | null {
		return this.currentController;
	}

	public get signal(): AbortSignal | null {
		return this.currentController?.signal ?? null;
	}
}

export class SseStreamBridge<T> {
	private readonly throttleMs: number;
	private readonly maxLines: number;
	private readonly onBatch?: (items: T[]) => void;

	private subject: Subject<T> | null = null;
	private subscription: Subscription | null = null;
	private pendingBuffer: T[] = [];
	private lines: T[] = [];
	private isDestroyed = false;

	constructor(options: SseBridgeOptions<T> = {}) {
		this.throttleMs = options.throttleMs ?? 16;
		this.maxLines = options.maxLines !== undefined ? options.maxLines : 2000;
		this.onBatch = options.onBatch;
	}

	public init(): void {
		this.teardown();
		this.isDestroyed = false;
		this.pendingBuffer = [];
		this.subject = new Subject<T>();
		this.subscription = this.subject
			.pipe(throttleTime(this.throttleMs, undefined, { leading: true, trailing: true }))
			.subscribe({
				next: () => {
					this.flush();
				},
				error: (err) => {
					console.error('SseStreamBridge subscription error:', err);
				}
			});
	}

	public push(item: T): void {
		if (this.isDestroyed) {
			return;
		}
		if (!this.subject) {
			this.init();
		}
		if (this.maxLines <= 0) {
			this.pendingBuffer = [];
			this.lines = [];
			return;
		}
		this.pendingBuffer.push(item);
		if (this.pendingBuffer.length > this.maxLines) {
			this.pendingBuffer = this.pendingBuffer.slice(-this.maxLines);
		}
		this.subject?.next(item);
	}

	public flush(): T[] {
		if (this.pendingBuffer.length === 0) {
			return this.lines;
		}
		const flushed = [...this.pendingBuffer];
		this.pendingBuffer = [];
		if (this.maxLines <= 0) {
			this.lines = [];
		} else {
			this.lines = [...this.lines, ...flushed].slice(-this.maxLines);
		}
		if (this.onBatch) {
			this.onBatch(flushed);
		}
		return this.lines;
	}

	public getLines(): T[] {
		return this.lines;
	}

	public clear(): void {
		this.pendingBuffer = [];
		this.lines = [];
	}

	public teardown(): void {
		this.isDestroyed = true;
		this.flush();
		if (this.subscription) {
			this.subscription.unsubscribe();
			this.subscription = null;
		}
		if (this.subject) {
			this.subject.complete();
			this.subject = null;
		}
	}
}

export interface ParsedSseFrame {
	event?: string;
	data: string;
	id?: string;
}

export interface ParseSseOptions {
	eof?: boolean;
}

/**
 * Parses raw SSE chunk text, properly handling CRLF (\r\n\r\n),
 * comments, bare data lines, multi-line data frames, and EOF flush.
 */
export function parseSseChunk(
	rawText: string,
	residualBuffer: string = '',
	options?: ParseSseOptions
): { frames: ParsedSseFrame[]; remainingBuffer: string } {
	let combined = residualBuffer + rawText;

	if (options?.eof) {
		if (!combined.trim()) {
			return { frames: [], remainingBuffer: '' };
		}
		combined = combined.replace(/\r$/, '\n');
		if (!combined.endsWith('\n\n')) {
			combined += combined.endsWith('\n') ? '\n' : '\n\n';
		}
	}

	let trailingCr = false;
	if (!options?.eof && combined.endsWith('\r')) {
		trailingCr = true;
		combined = combined.slice(0, -1);
	}

	// Normalize CRLF to LF
	const normalized = combined.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const rawEvents = normalized.split('\n\n');
	let remainingBuffer = rawEvents.pop() ?? '';
	if (trailingCr) {
		remainingBuffer += '\r';
	}
	if (options?.eof) {
		remainingBuffer = '';
	}

	const frames: ParsedSseFrame[] = [];

	for (const rawEvent of rawEvents) {
		const trimmed = rawEvent.trim();
		if (!trimmed) {
			continue;
		}

		const lines = rawEvent.split('\n');
		let event: string | undefined = undefined;
		let id: string | undefined = undefined;
		const dataLines: string[] = [];

		for (const line of lines) {
			if (line.startsWith(':')) {
				continue;
			}
			if (line.startsWith('event:')) {
				event = line.slice(6).trim();
			} else if (line.startsWith('id:')) {
				id = line.slice(3).trim();
			} else if (line === 'data') {
				dataLines.push('');
			} else if (line.startsWith('data:')) {
				dataLines.push(line.slice(5).replace(/^\s/, ''));
			}
		}

		if (dataLines.length > 0 || event !== undefined) {
			frames.push({
				event,
				id,
				data: dataLines.join('\n')
			});
		}
	}

	return { frames, remainingBuffer };
}
