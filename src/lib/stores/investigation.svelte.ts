import {
	CommandError,
	fetchOrderDetails,
	fetchOrders,
	issueCourtesyCredit,
	type OrderCase,
	type ToastMessage
} from '$lib/api/orders';
import { PreemptAbortManager } from '$lib/streams/sseBridge';

export type ProposalStatus = 'pending' | 'submitting' | 'approved' | 'dismissed';

const DEFAULT_OLIST_ORDERS: OrderCase[] = [
	{
		orderId: 'OL-94821-SP',
		orderUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
		customerId: 'cust-olist-88412',
		customerUniqueId: 'u88412-sp-vip',
		customerZipCodePrefix: '01310',
		customerCity: 'São Paulo',
		customerState: 'SP',
		customerName: 'Mariana Oliveira',
		customerTier: 'Olist VIP · Repeat Buyer',
		customerLtvBrl: 4820.5,
		tenant: 'SP-01',
		orderStatus: 'shipped',
		slaStatus: 'BREACHED',
		slaBadgeText: 'SLA BREACHED (+8.4 Days)',
		carrier: 'Correios SEDEX · Hub Cajamar',
		route: 'Curitiba (PR) → São Paulo (SP)',
		promisedAt: '2026-11-05T18:00:00Z',
		lifecycle: {
			purchaseTimestamp: '2026-10-28T14:12:00Z',
			approvedAt: '2026-10-28T14:26:00Z',
			deliveredCarrierDate: '2026-10-30T09:40:00Z',
			deliveredCustomerDate: null,
			estimatedDeliveryDate: '2026-11-05T18:00:00Z'
		},
		items: [
			{
				sku: 'OSTER-PL2-110V',
				productId: 'prod-422879e10f46682990de24d770e7f83d',
				sellerId: 'sell-1f50f920176fa81dab994f9023523100',
				sellerCity: 'Curitiba',
				sellerState: 'PR',
				name: 'Cafeteira Expresso Oster PrimaLatte II',
				category: 'eletroportateis',
				categoryEnglish: 'small_appliances',
				quantity: 1,
				unitPriceBrl: 1189.0,
				freightValueBrl: 29.8,
				shippingLimitDate: '2026-11-01T14:26:00Z'
			},
			{
				sku: 'PORC-XIC-06',
				productId: 'prod-99a4788cb24856965c36a24e339b6058',
				sellerId: 'sell-1f50f920176fa81dab994f9023523100',
				sellerCity: 'Curitiba',
				sellerState: 'PR',
				name: 'Conjunto Xícaras Porcelana 6 Peças',
				category: 'utilidades_domesticas',
				categoryEnglish: 'housewares',
				quantity: 1,
				unitPriceBrl: 149.0,
				freightValueBrl: 14.5,
				shippingLimitDate: '2026-11-01T14:26:00Z'
			}
		],
		payments: [
			{
				paymentSequential: 1,
				paymentType: 'credit_card',
				paymentInstallments: 6,
				paymentValueBrl: 1282.3
			},
			{
				paymentSequential: 2,
				paymentType: 'voucher',
				paymentInstallments: 1,
				paymentValueBrl: 100.0
			}
		],
		reviewOriginalPt:
			'Comprei a cafeteira para o aniversário da minha mãe e já passou mais de uma semana do prazo prometido. O rastreamento travou em Cajamar e ninguém responde no suporte.',
		reviewTranslatedEn:
			'I bought the espresso maker for my mother’s birthday and it is already more than a week past the promised delivery window. Tracking stalled in Cajamar and nobody is replying in support.',
		reviewRating: 1,
		reviewMeta: {
			reviewId: 'rev-7bc2406110b926393aa56f80a40eba40',
			score: 1,
			title: 'Atraso crítico em Cajamar',
			creationDate: '2026-11-13T10:15:00Z',
			answerTimestamp: '2026-11-13T11:02:00Z'
		},
		courtesyCreditBrl: 0,
		source: 'fallback',
		copilotSummary:
			'Carrier scan stalled 8.4 days past SLA at Hub Cajamar. High-LTV VIP customer (R$ 4.820,50) with 1-star review risk; Policy OLIST-SLA-T2 authorizes an automated R$ 29,80 courtesy credit.',
		thoughts: [
			{
				id: 'th-1',
				step: 'Correlate Apache Iggy carrier telemetry with promised SLA',
				detail: 'Detected 201.6h stall (+8.4 days over SLA) at Correios Cajamar sorting hub.',
				durationMs: 42
			},
			{
				id: 'th-2',
				step: 'Evaluate customer LTV & churn elasticity',
				detail: 'Customer LTV R$ 4.820,50 (top 4% cohort, 11 prior orders, 0 prior refunds).',
				durationMs: 31
			},
			{
				id: 'th-3',
				step: 'Compute Policy OLIST-SLA-T2 credit cap',
				detail: 'Freight-equivalent courtesy credit R$ 29,80 falls within Tier-2 specialist guardrail (<= R$ 50,00).',
				durationMs: 28
			}
		],
		toolCalls: [
			{ id: 'tc-1', tool: 'olist.orders.get_telemetry', status: 'ok', latencyMs: 38 },
			{ id: 'tc-2', tool: 'crm.ltv.lookup', status: 'ok', latencyMs: 24 },
			{ id: 'tc-3', tool: 'policy.sla_credit.quote', status: 'ok', latencyMs: 19 }
		],
		proposal: {
			id: 'prop-ol-94821',
			amountBrl: 29.8,
			formattedAmount: 'R$ 29,80',
			reason: 'SLA breach (+8.4 Days) courtesy freight & retention credit',
			policyCode: 'OLIST-SLA-T2'
		}
	},
	{
		orderId: 'OL-94790-RJ',
		orderUuid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
		customerId: 'cust-olist-77109',
		customerName: 'Rafael Mendes',
		customerTier: 'Standard · 3 Orders',
		customerLtvBrl: 940.0,
		tenant: 'RJ-01',
		slaStatus: 'AT_RISK',
		slaBadgeText: 'AT RISK (+1.2 Days)',
		carrier: 'Jadlog Expresso · Hub Benfica',
		route: 'Campinas (SP) → Rio de Janeiro (RJ)',
		promisedAt: '2026-11-12T20:00:00Z',
		items: [
			{
				sku: 'TECH-HUB-USB4',
				name: 'Hub USB-C 8-em-1 Alumínio',
				category: 'Informática',
				quantity: 1,
				unitPriceBrl: 239.9
			}
		],
		reviewOriginalPt:
			'O pedido saiu para entrega ontem mas ainda não chegou na portaria.',
		reviewTranslatedEn:
			'The order went out for delivery yesterday but has not arrived at the building reception yet.',
		reviewRating: 3,
		copilotSummary:
			'Last-mile attempt delayed 28h in Rio de Janeiro; monitoring next carrier scan before credit escalation.',
		thoughts: [
			{
				id: 'th-rj-1',
				step: 'Check Jadlog last-mile route manifest',
				detail: 'Courier vehicle rerouted due to coastal traffic advisory; ETA +6h.',
				durationMs: 35
			}
		],
		toolCalls: [
			{ id: 'tc-rj-1', tool: 'olist.orders.get_telemetry', status: 'warn', latencyMs: 44 }
		],
		proposal: {
			id: 'prop-ol-94790',
			amountBrl: 15.0,
			formattedAmount: 'R$ 15,00',
			reason: 'Last-mile delivery delay goodwill voucher',
			policyCode: 'OLIST-SLA-T1'
		}
	},
	{
		orderId: 'OL-94615-MG',
		orderUuid: 'c3d4e5f6-a7b8-4c9d-8e0f-2a3b4c5d6e7f',
		customerId: 'cust-olist-51023',
		customerName: 'Juliana Costa',
		customerTier: 'Olist Plus',
		customerLtvBrl: 2150.25,
		tenant: 'MG-01',
		slaStatus: 'BREACHED',
		slaBadgeText: 'SLA BREACHED (+4.1 Days)',
		carrier: 'Azul Cargo · Hub Confins',
		route: 'Joinville (SC) → Belo Horizonte (MG)',
		promisedAt: '2026-11-09T18:00:00Z',
		items: [
			{
				sku: 'CASA-LEN-Q400',
				name: 'Jogo de Lençol Queen 400 Fios',
				category: 'Cama, Mesa e Banho',
				quantity: 2,
				unitPriceBrl: 199.5
			}
		],
		reviewOriginalPt:
			'Atrasou bastante a entrega em Belo Horizonte, preciso de confirmação urgente.',
		reviewTranslatedEn:
			'Delivery in Belo Horizonte is significantly delayed, I need urgent confirmation.',
		reviewRating: 2,
		copilotSummary:
			'Linehaul hub transfer missed cutoff in Confins. Recommended R$ 22,50 courtesy credit.',
		thoughts: [
			{
				id: 'th-mg-1',
				step: 'Inspect Confins air-cargo manifest',
				detail: 'AWB transferred to ground shuttle after weather hold (+4.1 days).',
				durationMs: 29
			}
		],
		toolCalls: [
			{ id: 'tc-mg-1', tool: 'olist.orders.get_telemetry', status: 'ok', latencyMs: 31 },
			{ id: 'tc-mg-2', tool: 'policy.sla_credit.quote', status: 'ok', latencyMs: 18 }
		],
		proposal: {
			id: 'prop-ol-94615',
			amountBrl: 22.5,
			formattedAmount: 'R$ 22,50',
			reason: 'SLA breach (+4.1 Days) linehaul delay credit',
			policyCode: 'OLIST-SLA-T2'
		}
	}
];

export function formatBrl(value: number): string {
	if (!Number.isFinite(value)) {
		return 'R$ 0,00';
	}
	const isNegative = value < 0;
	const absValue = Math.abs(value);
	const [whole, decimals] = absValue.toFixed(2).split('.');
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	return `${isNegative ? '-' : ''}R$ ${grouped},${decimals}`;
}

export function createInvestigationStore(initialOrders: OrderCase[] = DEFAULT_OLIST_ORDERS) {
	const abortManager = new PreemptAbortManager();
	let orders = $state<OrderCase[]>(initialOrders);
	let activeOrderId = $state<string>(initialOrders[0]?.orderId ?? '');
	let showTranslation = $state<boolean>(false);
	let proposalStatusByOrder = $state<Record<string, ProposalStatus>>({});
	let errorByOrder = $state<Record<string, string | null>>({});
	let toast = $state<ToastMessage | null>(null);
	let dataSource = $state<'tidb' | 'fallback'>('fallback');
	let isSyncing = $state<boolean>(false);
	let nextToastId = 1;
	let epoch = 0;

	const activeOrder = $derived(
		orders.find((o) => o.orderId === activeOrderId) ?? orders[0] ?? null
	);

	const proposalStatus = $derived<ProposalStatus>(
		activeOrder ? (proposalStatusByOrder[activeOrder.orderId] ?? 'pending') : 'pending'
	);

	const proposalError = $derived<string | null>(
		activeOrder ? (errorByOrder[activeOrder.orderId] ?? null) : null
	);

	return {
		get abortManager() {
			return abortManager;
		},
		get orders() {
			return orders;
		},
		get activeOrderId() {
			return activeOrderId;
		},
		get activeOrder() {
			return activeOrder;
		},
		get showTranslation() {
			return showTranslation;
		},
		get proposalStatus() {
			return proposalStatus;
		},
		get proposalError() {
			return proposalError;
		},
		get toast() {
			return toast;
		},
		get dataSource() {
			return dataSource;
		},
		get isSyncing() {
			return isSyncing;
		},

		async loadLiveOrders(
			token: string | null,
			fetcher?: typeof fetch,
			limit = 10
		): Promise<boolean> {
			if (isSyncing) return false;
			isSyncing = true;
			const currentEpoch = epoch;
			try {
				const list = await fetchOrders(token, { limit }, fetcher);
				if (currentEpoch !== epoch || list.orders.length === 0) {
					return false;
				}
				const hydrated = await Promise.all(
					list.orders.slice(0, limit).map((summary) =>
						fetchOrderDetails(summary.order_id, token, fetcher).catch(() => null)
					)
				);
				if (currentEpoch !== epoch) {
					return false;
				}
				const valid = hydrated.filter((item): item is OrderCase => item !== null);
				if (valid.length === 0) {
					return false;
				}
				orders = valid;
				activeOrderId = valid[0].orderId;
				dataSource = 'tidb';
				return true;
			} catch {
				return false;
			} finally {
				if (currentEpoch === epoch) {
					isSyncing = false;
				}
			}
		},

		selectOrder(orderId: string) {
			abortManager.abort('Order switch');
			if (orders.some((o) => o.orderId === orderId)) {
				activeOrderId = orderId;
				showTranslation = false;
			}
		},

		toggleTranslation() {
			showTranslation = !showTranslation;
		},

		setShowTranslation(value: boolean) {
			showTranslation = value;
		},

		async approveProposal(
			token: string | null,
			fetcher?: typeof fetch
		): Promise<boolean> {
			abortManager.abort('Manual intervention');
			const order = activeOrder;
			if (!order) {
				return false;
			}

			const currentStatus = proposalStatusByOrder[order.orderId] ?? 'pending';
			if (
				currentStatus === 'submitting' ||
				currentStatus === 'approved' ||
				currentStatus === 'dismissed'
			) {
				return false;
			}

			const currentEpoch = epoch;
			proposalStatusByOrder[order.orderId] = 'submitting';
			errorByOrder[order.orderId] = null;

			try {
				await issueCourtesyCredit(
					{
						orderId: order.orderId,
						orderUuid: order.orderUuid,
						customerId: order.customerId,
						amountBrl: order.proposal.amountBrl,
						reason: order.proposal.reason,
						token
					},
					fetcher
				);

				if (currentEpoch !== epoch) {
					return false;
				}

				proposalStatusByOrder[order.orderId] = 'approved';
				toast = {
					id: nextToastId++,
					variant: 'amber',
					title: `Courtesy credit ${order.proposal.formattedAmount} issued`,
					detail: `Order ${order.orderId} (${order.customerName}) queued for immediate disbursement.`
				};
				return true;
			} catch (err) {
				if (currentEpoch !== epoch) {
					return false;
				}

				proposalStatusByOrder[order.orderId] = 'pending';
				errorByOrder[order.orderId] =
					err instanceof CommandError || err instanceof Error
						? err.message
						: 'Failed to issue courtesy credit.';
				return false;
			}
		},

		dismissProposal() {
			abortManager.abort('Manual intervention');
			const order = activeOrder;
			if (!order) {
				return;
			}
			const currentStatus = proposalStatusByOrder[order.orderId] ?? 'pending';
			if (currentStatus === 'submitting' || currentStatus === 'approved') {
				return;
			}
			proposalStatusByOrder[order.orderId] = 'dismissed';
			errorByOrder[order.orderId] = null;
		},

		dismissToast() {
			toast = null;
		},

		reset() {
			abortManager.abort('Reset');
			epoch += 1;
			orders = initialOrders;
			activeOrderId = initialOrders[0]?.orderId ?? '';
			showTranslation = false;
			proposalStatusByOrder = {};
			errorByOrder = {};
			toast = null;
		}
	};
}

export const investigationStore = createInvestigationStore();
