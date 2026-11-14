import { describe, expect, it, vi } from 'vitest';
import {
	createWorkspaceStore,
	normalizePath,
	REPLAY_QUICKSTART_URL,
	type WorkspacePath
} from './workspace.svelte';

describe('workspace store', () => {
	it('normalizes root, unknown, and valid workspace paths', () => {
		expect(normalizePath('/')).toBe('/investigation');
		expect(normalizePath('/unknown-route')).toBe('/investigation');
		expect(normalizePath('')).toBe('/investigation');

		const validPaths: WorkspacePath[] = [
			'/investigation',
			'/radar',
			'/analytics',
			'/simulator',
			'/benchmarks',
			'/pipeline-performance'
		];
		for (const path of validPaths) {
			expect(normalizePath(path)).toBe(path);
		}
	});

	it('initializes with normalized path and read-only replay status', () => {
		const store = createWorkspaceStore('/');
		expect(store.currentPath).toBe('/investigation');
		expect(store.replayStatus).toEqual({
			stream: 'olist/orders_stream',
			throughput: '24.8 msgs/s',
			mode: 'read-only',
			quickstartUrl: REPLAY_QUICKSTART_URL
		});

		const benchmarksStore = createWorkspaceStore('/benchmarks');
		expect(benchmarksStore.currentPath).toBe('/benchmarks');

		const invalidStore = createWorkspaceStore('/does-not-exist');
		expect(invalidStore.currentPath).toBe('/investigation');
	});

	it('normalizes paths in setCurrentPath', () => {
		const store = createWorkspaceStore();
		store.setCurrentPath('/radar');
		expect(store.currentPath).toBe('/radar');

		store.setCurrentPath('/not-a-valid-route');
		expect(store.currentPath).toBe('/investigation');
	});

	it('updates currentPath via navigateTo when gotoFn is omitted or succeeds', async () => {
		const store = createWorkspaceStore('/investigation');
		expect(store.navigateTo('/analytics')).toBeUndefined();
		expect(store.currentPath).toBe('/analytics');

		const syncGoto = vi.fn();
		store.navigateTo('/simulator', syncGoto);
		expect(syncGoto).toHaveBeenCalledWith('/simulator');
		expect(store.currentPath).toBe('/simulator');

		const asyncGoto = vi.fn().mockResolvedValue(undefined);
		await store.navigateTo('/benchmarks', asyncGoto);
		expect(asyncGoto).toHaveBeenCalledWith('/benchmarks');
		expect(store.currentPath).toBe('/benchmarks');
	});

	it('rolls back currentPath if gotoFn throws synchronously or rejects asynchronously', async () => {
		const store = createWorkspaceStore('/investigation');

		expect(() =>
			store.navigateTo('/benchmarks', () => {
				throw new Error('sync navigation failure');
			})
		).toThrow('sync navigation failure');
		expect(store.currentPath).toBe('/investigation');

		await expect(
			store.navigateTo('/pipeline-performance', () =>
				Promise.reject(new Error('async navigation failure'))
			)
		).rejects.toThrow('async navigation failure');
		expect(store.currentPath).toBe('/investigation');
	});
});
