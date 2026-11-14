import { describe, expect, it, vi } from 'vitest';
import { createInvestigationStore } from '$lib/stores/investigation.svelte';
import {
	createRadarStore,
	DEFAULT_SLA_BREACHES,
	TOTAL_ACTIVE_SLA_BREACHES,
	type SlaBreachItem
} from '$lib/stores/radar.svelte';
import { createWorkspaceStore } from '$lib/stores/workspace.svelte';

describe('radarStore (createRadarStore)', () => {
	it('returns TOTAL_ACTIVE_SLA_BREACHES (418) for default breaches and array length for custom/empty arrays', () => {
		const defaultStore = createRadarStore();
		expect(defaultStore.totalBreaches).toBe(TOTAL_ACTIVE_SLA_BREACHES);
		expect(defaultStore.breaches).toHaveLength(DEFAULT_SLA_BREACHES.length);

		const customBreaches: SlaBreachItem[] = [DEFAULT_SLA_BREACHES[0], DEFAULT_SLA_BREACHES[1]];
		const customStore = createRadarStore(customBreaches);
		expect(customStore.totalBreaches).toBe(2);

		const emptyStore = createRadarStore([]);
		expect(emptyStore.totalBreaches).toBe(0);
	});

	it('filters breaches by UF, carrier, and search query, and guards unknown carrierFilter as ALL', () => {
		const store = createRadarStore();

		store.setUfFilter('SP');
		expect(store.filteredBreaches.every((b) => b.uf === 'SP')).toBe(true);
		expect(store.filteredBreaches).toHaveLength(3);

		store.setCarrierFilter('Correios SEDEX');
		expect(
			store.filteredBreaches.every((b) => b.uf === 'SP' && b.carrier === 'Correios SEDEX')
		).toBe(true);
		expect(store.filteredBreaches).toHaveLength(2);

		store.setSearchQuery('Cajamar');
		expect(store.filteredBreaches).toHaveLength(1);
		expect(store.filteredBreaches[0].orderId).toBe('OL-94821-SP');

		// Unknown/stale carrierFilter should be treated as 'ALL'
		store.clearFilters();
		store.setCarrierFilter('NonExistentCarrier');
		expect(store.filteredBreaches).toHaveLength(DEFAULT_SLA_BREACHES.length);
	});

	it('updates selectedCluster on selectCluster and restores defaults on reset()', () => {
		const store = createRadarStore();

		expect(store.selectedClusterUf).toBe('SP');
		expect(store.selectedCluster.stateName).toBe('São Paulo');

		store.selectCluster('BA');
		expect(store.selectedClusterUf).toBe('BA');
		expect(store.selectedCluster.stateName).toBe('Bahia');

		store.setUfFilter('RJ');
		store.setCarrierFilter('DirectLog');
		store.setSearchQuery('Benfica');

		store.reset();
		expect(store.ufFilter).toBe('ALL');
		expect(store.carrierFilter).toBe('ALL');
		expect(store.searchQuery).toBe('');
		expect(store.selectedClusterUf).toBe('SP');
		expect(store.selectedCluster.stateName).toBe('São Paulo');
		expect(store.filteredBreaches).toHaveLength(DEFAULT_SLA_BREACHES.length);
	});

	it('selectBreachAndInvestigate handles exact match, UF match, BA/RS fallback, empty orders no-op, and gotoFn throwing', () => {
		const store = createRadarStore();
		const invStore = createInvestigationStore();
		const wsStore = createWorkspaceStore('/radar');
		const gotoOk = vi.fn();

		// 1. Exact match
		store.selectBreachAndInvestigate('OL-94790-RJ', invStore, wsStore, gotoOk);
		expect(invStore.activeOrderId).toBe('OL-94790-RJ');
		expect(wsStore.currentPath).toBe('/investigation');
		expect(gotoOk).toHaveBeenCalledWith('/investigation');

		// 2. UF match (non-queued RJ breach -> OL-94790-RJ)
		wsStore.setCurrentPath('/radar');
		invStore.selectOrder('OL-94821-SP');
		store.selectBreachAndInvestigate('OL-94512-RJ', invStore, wsStore, gotoOk);
		expect(invStore.activeOrderId).toBe('OL-94790-RJ');
		expect(wsStore.currentPath).toBe('/investigation');

		// 3. BA / RS fallback (no BA/RS order in invStore.orders -> falls back to invStore.orders[0])
		wsStore.setCurrentPath('/radar');
		invStore.selectOrder('OL-94615-MG');
		store.selectBreachAndInvestigate('OL-94365-BA', invStore, wsStore, gotoOk);
		expect(invStore.activeOrderId).toBe(invStore.orders[0].orderId);
		expect(wsStore.currentPath).toBe('/investigation');

		wsStore.setCurrentPath('/radar');
		invStore.selectOrder('OL-94615-MG');
		store.selectBreachAndInvestigate('OL-94310-RS', invStore, wsStore, gotoOk);
		expect(invStore.activeOrderId).toBe(invStore.orders[0].orderId);
		expect(wsStore.currentPath).toBe('/investigation');

		// 4. Empty invStore.orders -> early return without navigating
		const emptyInvStore = createInvestigationStore([]);
		const wsEmpty = createWorkspaceStore('/radar');
		const gotoEmpty = vi.fn();
		store.selectBreachAndInvestigate('OL-94821-SP', emptyInvStore, wsEmpty, gotoEmpty);
		expect(wsEmpty.currentPath).toBe('/radar');
		expect(gotoEmpty).not.toHaveBeenCalled();

		// 5. gotoFn throwing -> does not throw out of selectBreachAndInvestigate, workspace rolls back
		const wsThrow = createWorkspaceStore('/radar');
		const gotoThrow = vi.fn(() => {
			throw new Error('navigation aborted');
		});
		expect(() =>
			store.selectBreachAndInvestigate('OL-94821-SP', invStore, wsThrow, gotoThrow)
		).not.toThrow();
		expect(gotoThrow).toHaveBeenCalledWith('/investigation');
		expect(wsThrow.currentPath).toBe('/radar');
	});
});
