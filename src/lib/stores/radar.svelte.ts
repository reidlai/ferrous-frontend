import { goto } from '$app/navigation';
import { fetchOlistTableStats, type OlistTableStat } from '$lib/api/orders';
import { investigationStore, type createInvestigationStore } from '$lib/stores/investigation.svelte';
import { workspace, type createWorkspaceStore } from '$lib/stores/workspace.svelte';

export type UfCode = 'SP' | 'RJ' | 'MG' | 'BA' | 'RS';
export type UfFilter = 'ALL' | 'SP' | 'RJ' | 'MG';
export type BreachSeverity = 'CRITICAL' | 'HIGH' | 'ELEVATED';

export interface SlaBreachItem {
	orderId: string;
	customerName: string;
	carrier: string;
	uf: UfCode;
	delayDays: number;
	riskScore: number;
	severity: BreachSeverity;
	hub: string;
	promisedDate: string;
	investigable: boolean;
}

export interface CarrierBenchmark {
	id: string;
	name: string;
	slaCompliancePct: number;
	avgDelayDays: number;
	p95TransitDays: number;
	activeBreaches: number;
	trendLabel: string;
	trendDirection: 'up' | 'down';
	accent: 'amber' | 'emerald' | 'rose';
}

export interface RegionalCluster {
	uf: UfCode;
	stateName: string;
	activeBreaches: number;
	sharePct: number;
	avgDelayDays: number;
	topBottleneck: string;
	severity: BreachSeverity;
}

export interface OlistTopicStatus {
	topic: string;
	partitions: number;
	throughputMsgsPerSec: number;
	currentOffset: number;
	highWatermark: number;
	profileTotalEvents: number;
	consumerGroup: string;
	consumerLagMsgs: number;
	mode: 'read-only';
	quickstartRepo: string;
	quickstartCommand: string;
	quickstartBinary: string;
}

export interface OlistTidbTableStatus {
	tableName:
		| 'olist_orders'
		| 'olist_order_items'
		| 'olist_order_payments'
		| 'olist_order_reviews'
		| 'olist_customers'
		| 'olist_products'
		| 'olist_sellers'
		| 'olist_geolocation'
		| 'olist_category_translation'
		| 'orders_current_state'
		| string;
	role: string;
	ingestionMode: string;
	rowCount: number;
	status: 'synced' | 'empty';
}

/** Backwards-compatible alias for legacy imports */
export type OlistDeltaTableStatus = OlistTidbTableStatus;

export interface OlistStreamTopicInfo {
	topic: string;
	targetTable: string;
	profile: string;
}

export const OLIST_STREAM_TOPICS: OlistStreamTopicInfo[] = [
	{ topic: 'olist/orders_stream', targetTable: 'olist_orders', profile: 'olist-demo.toml' },
	{ topic: 'olist/order_items_stream', targetTable: 'olist_order_items', profile: 'olist-items.toml' },
	{ topic: 'olist/order_payments_stream', targetTable: 'olist_order_payments', profile: 'olist-payments.toml' },
	{ topic: 'olist/order_reviews_stream', targetTable: 'olist_order_reviews', profile: 'olist-reviews.toml' }
];

export const TOTAL_ACTIVE_SLA_BREACHES = 418;

export const DEFAULT_SLA_BREACHES: SlaBreachItem[] = [
	{
		orderId: 'OL-94821-SP',
		customerName: 'Mariana Oliveira',
		carrier: 'Correios SEDEX',
		uf: 'SP',
		delayDays: 8.4,
		riskScore: 96,
		severity: 'CRITICAL',
		hub: 'Hub Cajamar',
		promisedDate: '2026-11-05',
		investigable: true
	},
	{
		orderId: 'OL-94790-RJ',
		customerName: 'Rafael Mendes',
		carrier: 'Jadlog Expresso',
		uf: 'RJ',
		delayDays: 1.2,
		riskScore: 68,
		severity: 'ELEVATED',
		hub: 'Hub Benfica',
		promisedDate: '2026-11-12',
		investigable: true
	},
	{
		orderId: 'OL-94615-MG',
		customerName: 'Juliana Costa',
		carrier: 'Azul Cargo',
		uf: 'MG',
		delayDays: 4.1,
		riskScore: 84,
		severity: 'HIGH',
		hub: 'Hub Confins',
		promisedDate: '2026-11-09',
		investigable: true
	},
	{
		orderId: 'OL-94588-SP',
		customerName: 'Lucas Ferreira',
		carrier: 'DirectLog',
		uf: 'SP',
		delayDays: 5.7,
		riskScore: 89,
		severity: 'CRITICAL',
		hub: 'Hub Barueri',
		promisedDate: '2026-11-08',
		investigable: false
	},
	{
		orderId: 'OL-94512-RJ',
		customerName: 'Camila Rodrigues',
		carrier: 'Correios SEDEX',
		uf: 'RJ',
		delayDays: 6.3,
		riskScore: 91,
		severity: 'CRITICAL',
		hub: 'CTCE Benfica',
		promisedDate: '2026-11-07',
		investigable: false
	},
	{
		orderId: 'OL-94479-MG',
		customerName: 'Bruno Almeida',
		carrier: 'DirectLog',
		uf: 'MG',
		delayDays: 3.4,
		riskScore: 76,
		severity: 'HIGH',
		hub: 'Hub Contagem',
		promisedDate: '2026-11-10',
		investigable: false
	},
	{
		orderId: 'OL-94401-SP',
		customerName: 'Fernanda Lima',
		carrier: 'Correios SEDEX',
		uf: 'SP',
		delayDays: 2.8,
		riskScore: 72,
		severity: 'HIGH',
		hub: 'CTCE Jaguaré',
		promisedDate: '2026-11-11',
		investigable: false
	},
	{
		orderId: 'OL-94365-BA',
		customerName: 'Thiago Santos',
		carrier: 'DirectLog',
		uf: 'BA',
		delayDays: 7.1,
		riskScore: 90,
		severity: 'CRITICAL',
		hub: 'Hub Simões Filho',
		promisedDate: '2026-11-06',
		investigable: false
	},
	{
		orderId: 'OL-94310-RS',
		customerName: 'Patrícia Souza',
		carrier: 'Correios SEDEX',
		uf: 'RS',
		delayDays: 3.9,
		riskScore: 78,
		severity: 'HIGH',
		hub: 'CTCE Porto Alegre',
		promisedDate: '2026-11-10',
		investigable: false
	}
];

export const CARRIER_BENCHMARKS: CarrierBenchmark[] = [
	{
		id: 'correios-sedex',
		name: 'Correios SEDEX',
		slaCompliancePct: 86.4,
		avgDelayDays: 4.9,
		p95TransitDays: 11.2,
		activeBreaches: 184,
		trendLabel: '-2.1% vs 7d',
		trendDirection: 'down',
		accent: 'rose'
	},
	{
		id: 'directlog',
		name: 'DirectLog',
		slaCompliancePct: 91.8,
		avgDelayDays: 3.2,
		p95TransitDays: 8.6,
		activeBreaches: 112,
		trendLabel: '+1.4% vs 7d',
		trendDirection: 'up',
		accent: 'emerald'
	}
];

export const REGIONAL_CLUSTERS: RegionalCluster[] = [
	{
		uf: 'SP',
		stateName: 'São Paulo',
		activeBreaches: 168,
		sharePct: 40.2,
		avgDelayDays: 4.8,
		topBottleneck: 'Hub Cajamar · Correios SEDEX',
		severity: 'CRITICAL'
	},
	{
		uf: 'RJ',
		stateName: 'Rio de Janeiro',
		activeBreaches: 98,
		sharePct: 23.4,
		avgDelayDays: 4.1,
		topBottleneck: 'CTCE Benfica · Last-mile congestion',
		severity: 'HIGH'
	},
	{
		uf: 'MG',
		stateName: 'Minas Gerais',
		activeBreaches: 72,
		sharePct: 17.2,
		avgDelayDays: 3.7,
		topBottleneck: 'Hub Confins · Linehaul cutoff',
		severity: 'HIGH'
	},
	{
		uf: 'BA',
		stateName: 'Bahia',
		activeBreaches: 46,
		sharePct: 11.0,
		avgDelayDays: 6.2,
		topBottleneck: 'Simões Filho · Interstate transfer',
		severity: 'CRITICAL'
	},
	{
		uf: 'RS',
		stateName: 'Rio Grande do Sul',
		activeBreaches: 34,
		sharePct: 8.1,
		avgDelayDays: 3.5,
		topBottleneck: 'Porto Alegre · Weather hold',
		severity: 'ELEVATED'
	}
];

export const OLIST_TOPIC_STATUS: OlistTopicStatus = {
	topic: 'olist/orders_stream',
	partitions: 12,
	throughputMsgsPerSec: 24.8,
	currentOffset: 1_048_291,
	highWatermark: 1_250_000,
	profileTotalEvents: 1_250_000,
	consumerGroup: 'tidb-sink',
	consumerLagMsgs: 0,
	mode: 'read-only',
	quickstartRepo: 'ferrous-cx',
	quickstartCommand: 'make quickstart',
	quickstartBinary: 'stream-replay-rs'
};

export const OLIST_TIDB_TABLES: OlistTidbTableStatus[] = [
	{
		tableName: 'olist_orders',
		role: 'Canonical Order Fact',
		ingestionMode: 'stream: olist/orders_stream',
		rowCount: 99441,
		status: 'synced'
	},
	{
		tableName: 'olist_order_items',
		role: 'Order Line Items',
		ingestionMode: 'stream: olist/order_items_stream',
		rowCount: 112650,
		status: 'synced'
	},
	{
		tableName: 'olist_order_payments',
		role: 'Order Payment Legs',
		ingestionMode: 'stream: olist/order_payments_stream',
		rowCount: 103886,
		status: 'synced'
	},
	{
		tableName: 'olist_order_reviews',
		role: 'Customer Reviews',
		ingestionMode: 'stream: olist/order_reviews_stream',
		rowCount: 99224,
		status: 'synced'
	},
	{
		tableName: 'olist_customers',
		role: 'Customer Directory',
		ingestionMode: 'dimension: batch',
		rowCount: 99441,
		status: 'synced'
	},
	{
		tableName: 'olist_products',
		role: 'Product Catalog',
		ingestionMode: 'dimension: batch',
		rowCount: 32951,
		status: 'synced'
	},
	{
		tableName: 'olist_sellers',
		role: 'Seller Directory',
		ingestionMode: 'dimension: batch',
		rowCount: 3095,
		status: 'synced'
	},
	{
		tableName: 'olist_geolocation',
		role: 'CEP Geolocation',
		ingestionMode: 'dimension: batch',
		rowCount: 19015,
		status: 'synced'
	},
	{
		tableName: 'olist_category_translation',
		role: 'PT→EN Categories',
		ingestionMode: 'dimension: batch',
		rowCount: 71,
		status: 'synced'
	},
	{
		tableName: 'orders_current_state',
		role: 'CQRS Materialized View',
		ingestionMode: 'stream: orders/consolidated',
		rowCount: 99441,
		status: 'synced'
	}
];

/** Backwards-compatible alias */
export const OLIST_DELTA_TABLES: OlistTidbTableStatus[] = OLIST_TIDB_TABLES;

export function createRadarStore(initialBreaches: SlaBreachItem[] = DEFAULT_SLA_BREACHES) {
	let breaches = $state.raw<SlaBreachItem[]>(initialBreaches);
	let ufFilter = $state<UfFilter>('ALL');
	let carrierFilter = $state<string>('ALL');
	let searchQuery = $state<string>('');
	let selectedClusterUf = $state<UfCode>('SP');
	let tidbTables = $state<OlistTidbTableStatus[]>(OLIST_TIDB_TABLES);
	let storageEngine = $state<string>('tidb');

	const carrierOptions = $derived(
		Array.from(new Set(breaches.map((b) => b.carrier))).sort((a, b) => a.localeCompare(b))
	);

	const filteredBreaches = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		const effectiveCarrier =
			carrierFilter !== 'ALL' && carrierOptions.includes(carrierFilter) ? carrierFilter : 'ALL';
		return breaches.filter((item) => {
			if (ufFilter !== 'ALL' && item.uf !== ufFilter) {
				return false;
			}
			if (effectiveCarrier !== 'ALL' && item.carrier !== effectiveCarrier) {
				return false;
			}
			if (!query) {
				return true;
			}
			return (
				item.orderId.toLowerCase().includes(query) ||
				item.customerName.toLowerCase().includes(query) ||
				item.carrier.toLowerCase().includes(query) ||
				item.hub.toLowerCase().includes(query) ||
				item.uf.toLowerCase().includes(query)
			);
		});
	});

	const selectedCluster = $derived(
		REGIONAL_CLUSTERS.find((c) => c.uf === selectedClusterUf) ?? REGIONAL_CLUSTERS[0]
	);

	function safeNavigateToInvestigation(
		wsStore: ReturnType<typeof createWorkspaceStore>,
		gotoFn?: (url: string) => unknown
	): void {
		const navTarget = gotoFn
			? gotoFn
			: (target: string) => {
					try {
						return goto(target);
					} catch {
						// Ignore router-uninitialized errors in isolated unit tests / SSR.
						return undefined;
					}
				};
		try {
			Promise.resolve(wsStore.navigateTo('/investigation', navTarget)).catch(() => undefined);
		} catch {
			// Ignore synchronous navigation errors in isolated unit tests / SSR.
		}
	}

	return {
		get totalBreaches() {
			return breaches === DEFAULT_SLA_BREACHES ? TOTAL_ACTIVE_SLA_BREACHES : breaches.length;
		},
		get topicStatus() {
			return OLIST_TOPIC_STATUS;
		},
		get breaches() {
			return breaches;
		},
		get filteredBreaches() {
			return filteredBreaches;
		},
		get ufFilter() {
			return ufFilter;
		},
		get carrierFilter() {
			return carrierFilter;
		},
		get carrierOptions() {
			return carrierOptions;
		},
		get searchQuery() {
			return searchQuery;
		},
		get selectedClusterUf() {
			return selectedClusterUf;
		},
		get selectedCluster() {
			return selectedCluster;
		},
		get tidbTables() {
			return tidbTables;
		},
		get storageEngine() {
			return storageEngine;
		},

		async loadTableStats(token: string | null = null, fetcher?: typeof fetch): Promise<boolean> {
			try {
				const stats = await fetchOlistTableStats(token, fetcher);
				if (stats.tables.length > 0) {
					tidbTables = stats.tables;
					storageEngine = stats.storageEngine;
					return true;
				}
				return false;
			} catch {
				return false;
			}
		},

		setUfFilter(uf: UfFilter) {
			ufFilter = uf;
		},

		setCarrierFilter(carrier: string) {
			carrierFilter = carrier;
		},

		setSearchQuery(query: string) {
			searchQuery = query;
		},

		clearFilters() {
			ufFilter = 'ALL';
			carrierFilter = 'ALL';
			searchQuery = '';
		},

		selectCluster(uf: UfCode) {
			selectedClusterUf = uf;
		},

		selectBreachAndInvestigate(
			orderId: string,
			invStore: ReturnType<typeof createInvestigationStore> = investigationStore,
			wsStore: ReturnType<typeof createWorkspaceStore> = workspace,
			gotoFn?: (url: string) => unknown
		) {
			const exactMatch = invStore.orders.find((o) => o.orderId === orderId);
			if (exactMatch) {
				invStore.selectOrder(exactMatch.orderId);
			} else {
				const breach = breaches.find((b) => b.orderId === orderId);
				const ufMatch = breach
					? invStore.orders.find((o) => o.tenant.split('-')[0] === breach.uf)
					: undefined;
				const fallback = ufMatch ?? invStore.orders[0];
				if (!fallback) {
					return;
				}
				invStore.selectOrder(fallback.orderId);
			}
			safeNavigateToInvestigation(wsStore, gotoFn);
		},

		reset() {
			breaches = initialBreaches;
			ufFilter = 'ALL';
			carrierFilter = 'ALL';
			searchQuery = '';
			selectedClusterUf = 'SP';
		}
	};
}

export const radarStore = createRadarStore();
