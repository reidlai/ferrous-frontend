import { describe, it, expect, vi } from 'vitest';
import { PreemptAbortManager, SseStreamBridge, parseSseChunk } from './sseBridge';

describe('Story 10.7: PreemptAbortManager (<50ms Concurrency & Targeted Abort)', () => {
	it('spawns new controller and preempts existing in-flight controller in <50ms', () => {
		const manager = new PreemptAbortManager();
		const c1 = manager.spawn();
		expect(c1.signal.aborted).toBe(false);
		expect(manager.signal).toBe(c1.signal);

		const startTime = performance.now();
		const c2 = manager.spawn();
		const elapsed = performance.now() - startTime;

		expect(c1.signal.aborted).toBe(true);
		expect(c1.signal.reason).toBe('Preempted');
		expect(c2.signal.aborted).toBe(false);
		expect(elapsed).toBeLessThan(50);
	});

	it('abort() cancels active controller and clears reference', () => {
		const manager = new PreemptAbortManager();
		const c = manager.spawn();
		manager.abort('Manual Cancel');
		expect(c.signal.aborted).toBe(true);
		expect(c.signal.reason).toBe('Manual Cancel');
		expect(manager.active).toBeNull();
		expect(manager.signal).toBeNull();
	});

	it('fires synchronous abort event listener with reason Preempted without re-entrant null-out race', () => {
		const manager = new PreemptAbortManager();
		const c1 = manager.spawn();
		let listenerFired = false;
		let managerActiveInsideListener: AbortController | null = null;
		let abortReason = '';

		c1.signal.addEventListener('abort', () => {
			listenerFired = true;
			// Ensure manager cleared currentController before calling abort to prevent re-entrant race
			managerActiveInsideListener = manager.active;
			abortReason = c1.signal.reason;
		});

		manager.spawn(); // Preempts c1

		expect(listenerFired).toBe(true);
		expect(abortReason).toBe('Preempted');
		expect(managerActiveInsideListener).toBeNull();
		expect(c1.signal.aborted).toBe(true);
	});

	it('supports targeted controller abort and release', () => {
		const manager = new PreemptAbortManager();
		const c1 = manager.spawn();

		// Targeted abort
		manager.abort(c1, 'Targeted abort reason');
		expect(c1.signal.aborted).toBe(true);
		expect(c1.signal.reason).toBe('Targeted abort reason');
		expect(manager.active).toBeNull();

		// Spawn new controller and release
		const c2 = manager.spawn();
		expect(manager.active).toBe(c2);
		manager.release(c2);
		expect(manager.active).toBeNull();
		expect(c2.signal.aborted).toBe(false); // Released without aborting
	});
});

describe('Story 10.7: SseStreamBridge (RxJS Batching, Bounded Ring Buffer & Leak Hardening)', () => {
	it('batches high-frequency emissions via throttleTime and bounds maxLines', async () => {
		vi.useFakeTimers();
		try {
			const onBatch = vi.fn();
			const bridge = new SseStreamBridge<string>({ throttleMs: 16, maxLines: 5, onBatch });
			bridge.init();

			// Push 10 items rapidly
			for (let i = 1; i <= 10; i++) {
				bridge.push(`item-${i}`);
			}

			// Leading edge fires
			await vi.advanceTimersByTimeAsync(0);
			// Advance through throttle window
			await vi.advanceTimersByTimeAsync(20);

			const lines = bridge.getLines();
			expect(lines.length).toBeLessThanOrEqual(5);
			expect(lines).toEqual(['item-6', 'item-7', 'item-8', 'item-9', 'item-10']);
			expect(onBatch).toHaveBeenCalled();

			bridge.teardown();
		} finally {
			vi.useRealTimers();
		}
	});

	it('clear() empties pending buffer and lines', () => {
		const bridge = new SseStreamBridge<string>();
		bridge.init();
		bridge.push('test-1');
		bridge.flush();
		expect(bridge.getLines()).toEqual(['test-1']);
		bridge.clear();
		expect(bridge.getLines()).toEqual([]);
		bridge.teardown();
	});

	it('prevents resurrection after teardown and flushes trailing pending buffer', () => {
		const bridge = new SseStreamBridge<string>();
		bridge.init();
		bridge.push('unflushed-1');
		bridge.push('unflushed-2');

		// Teardown should flush pending items before completing subject
		bridge.teardown();
		expect(bridge.getLines()).toEqual(['unflushed-1', 'unflushed-2']);

		// Subsequent push after teardown must be ignored (no resurrection / no leak)
		bridge.push('ghost-3');
		expect(bridge.getLines()).toEqual(['unflushed-1', 'unflushed-2']);
	});

	it('safely handles maxLines <= 0 without unbounded growth or errors', () => {
		const bridge = new SseStreamBridge<string>({ maxLines: 0 });
		bridge.init();
		bridge.push('should-drop');
		bridge.flush();
		expect(bridge.getLines()).toEqual([]);
		bridge.teardown();
	});
});

describe('Story 10.7: parseSseChunk (CRLF, Comments, Bare Data, EOF & Error Events)', () => {
	it('parses standard LF and CRLF frames with comments', () => {
		const raw = ': ping\n\nevent: telemetry\r\ndata: {"ok":true}\r\n\r\n: keepalive\r\n\r\n';
		const { frames, remainingBuffer } = parseSseChunk(raw);

		expect(frames).toHaveLength(1);
		expect(frames[0]).toEqual({
			event: 'telemetry',
			id: undefined,
			data: '{"ok":true}'
		});
		expect(remainingBuffer).toBe('');
	});

	it('parses event: error frames cleanly', () => {
		const raw = 'event: error\ndata: {"error":"Rate limit reached","code":429}\n\n';
		const { frames, remainingBuffer } = parseSseChunk(raw);

		expect(frames).toHaveLength(1);
		expect(frames[0]).toEqual({
			event: 'error',
			id: undefined,
			data: '{"error":"Rate limit reached","code":429}'
		});
		expect(remainingBuffer).toBe('');
	});

	it('handles mixed leading and interleaved comment lines without dropping data', () => {
		const raw = ': leading comment 1\n: leading comment 2\nevent: update\n: mid comment\ndata: row 1\n: another comment\ndata: row 2\n\n';
		const { frames, remainingBuffer } = parseSseChunk(raw);

		expect(frames).toHaveLength(1);
		expect(frames[0]).toEqual({
			event: 'update',
			id: undefined,
			data: 'row 1\nrow 2'
		});
		expect(remainingBuffer).toBe('');
	});

	it('supports WHATWG bare data lines', () => {
		const raw = 'data\ndata: middle\ndata\n\n';
		const { frames } = parseSseChunk(raw);

		expect(frames).toHaveLength(1);
		expect(frames[0].data).toBe('\nmiddle\n');
	});

	it('correctly handles multi-line data lines and splits residual buffers', () => {
		const raw = 'data: line 1\ndata: line 2\n\ndata: partial';
		const { frames, remainingBuffer } = parseSseChunk(raw);

		expect(frames).toHaveLength(1);
		expect(frames[0].data).toBe('line 1\nline 2');
		expect(remainingBuffer).toBe('data: partial');

		// Complete the partial frame
		const { frames: secondFrames } = parseSseChunk('\n\n', remainingBuffer);
		expect(secondFrames).toHaveLength(1);
		expect(secondFrames[0].data).toBe('partial');
	});

	it('handles split CRLF across chunk boundaries without premature splitting', () => {
		// First chunk ends with \r
		const chunk1 = 'data: split-value\r';
		const { frames: frames1, remainingBuffer: rem1 } = parseSseChunk(chunk1);
		expect(frames1).toHaveLength(0);
		expect(rem1).toBe('data: split-value\r');

		// Second chunk completes \r\n\r\n
		const chunk2 = '\n\r\n';
		const { frames: frames2, remainingBuffer: rem2 } = parseSseChunk(chunk2, rem1);
		expect(frames2).toHaveLength(1);
		expect(frames2[0].data).toBe('split-value');
		expect(rem2).toBe('');
	});

	it('flushes residual buffer on EOF ({ eof: true })', () => {
		// Incomplete stream ending without trailing double newlines
		const residual = 'event: stream_end\ndata: final telemetry payload';
		const { frames, remainingBuffer } = parseSseChunk('', residual, { eof: true });

		expect(frames).toHaveLength(1);
		expect(frames[0]).toEqual({
			event: 'stream_end',
			id: undefined,
			data: 'final telemetry payload'
		});
		expect(remainingBuffer).toBe('');
	});
});
