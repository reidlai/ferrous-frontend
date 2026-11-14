import { describe, expect, it, vi } from 'vitest';
import { createInvestigationStore, formatBrl } from './investigation.svelte';
import { PreemptAbortManager } from '$lib/streams/sseBridge';

describe('Story 10.7: Investigation Store Concurrency & Preempt-and-Abort Wiring', () => {
	it('exposes abortManager as an instance of PreemptAbortManager', () => {
		const store = createInvestigationStore();
		expect(store.abortManager).toBeDefined();
		expect(store.abortManager).toBeInstanceOf(PreemptAbortManager);
	});

	it('triggers abortManager.abort("Order switch") on selectOrder', () => {
		const store = createInvestigationStore();
		const abortSpy = vi.spyOn(store.abortManager, 'abort');

		// Active order is initially OL-94821-SP; switch to second order
		store.selectOrder('OL-94790-RJ');

		expect(abortSpy).toHaveBeenCalledWith('Order switch');
		expect(store.activeOrderId).toBe('OL-94790-RJ');
	});

	it('triggers abortManager.abort("Manual intervention") on dismissProposal', () => {
		const store = createInvestigationStore();
		const abortSpy = vi.spyOn(store.abortManager, 'abort');

		store.dismissProposal();

		expect(abortSpy).toHaveBeenCalledWith('Manual intervention');
		expect(store.proposalStatus).toBe('dismissed');
	});

	it('triggers abortManager.abort("Manual intervention") on approveProposal', async () => {
		const store = createInvestigationStore();
		const abortSpy = vi.spyOn(store.abortManager, 'abort');

		const mockFetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					command_id: 'cmd-1',
					status: 'ACCEPTED',
					timestamp: '2026-11-14T00:00:00Z'
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		await store.approveProposal('test-token', mockFetch as unknown as typeof fetch);

		expect(abortSpy).toHaveBeenCalledWith('Manual intervention');
		expect(store.proposalStatus).toBe('approved');
	});

	it('formats BRL values correctly', () => {
		expect(formatBrl(29.8)).toBe('R$ 29,80');
		expect(formatBrl(4820.5)).toBe('R$ 4.820,50');
		expect(formatBrl(-15)).toBe('-R$ 15,00');
		expect(formatBrl(NaN)).toBe('R$ 0,00');
	});

	it('toggles translation and resets store cleanly', () => {
		const store = createInvestigationStore();
		expect(store.showTranslation).toBe(false);

		store.toggleTranslation();
		expect(store.showTranslation).toBe(true);

		const abortSpy = vi.spyOn(store.abortManager, 'abort');
		store.reset();
		expect(abortSpy).toHaveBeenCalledWith('Reset');
		expect(store.showTranslation).toBe(false);
	});
});
