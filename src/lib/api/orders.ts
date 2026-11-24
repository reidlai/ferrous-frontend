export type OlistOrderStatus =
	| 'created'
	| 'approved'
	| 'invoiced'
	| 'processing'
	| 'shipped'
	| 'delivered'
	| 'unavailable'
	| 'canceled';

export interface OrderItem {
	sku: string;
	name: string;
	category: string;
	quantity: number;
	unitPriceBrl: number;
	/** Canonical Kaggle `olist_order_items` / `olist_products` / `olist_sellers` fields */
	productId?: string;
	sellerId?: string;
	sellerCity?: string;
	sellerState?: string;
	freightValueBrl?: number;
	categoryEnglish?: string;
	shippingLimitDate?: string | null;
}

export interface OrderPayment {
	paymentSequential: number;
	paymentType: 'credit_card' | 'boleto' | 'voucher' | 'debit_card' | 'not_defined' | string;
	paymentInstallments: number;
	paymentValueBrl: number;
}

export interface OrderLifecycle {
	purchaseTimestamp: string;
	approvedAt?: string | null;
	deliveredCarrierDate?: string | null;
	deliveredCustomerDate?: string | null;
	estimatedDeliveryDate: string;
}

export interface OrderReviewMeta {
	reviewId: string;
	score: number;
	title?: string | null;
	creationDate?: string | null;
	answerTimestamp?: string | null;
}

export interface OlistTableStat {
	tableName: string;
	role: string;
	ingestionMode: string;
	rowCount: number;
	status: 'synced' | 'empty';
}

export interface OlistTablesResponse {
	storageEngine: string;
	tables: OlistTableStat[];
	totalRows: number;
}

export interface CopilotThought {
	id: string;
	step: string;
	detail: string;
	durationMs: number;
}

export interface ToolCallBadge {
	id: string;
	tool: string;
	status: 'ok' | 'warn' | 'error';
	latencyMs: number;
}

export interface CreditProposal {
	id: string;
	amountBrl: number;
	formattedAmount: string;
	reason: string;
	policyCode: string;
}

export interface OrderCase {
	orderId: string;
	orderUuid?: string;
	customerId: string;
	customerName: string;
	customerTier: string;
	customerLtvBrl: number;
	tenant: string;
	slaStatus: 'BREACHED' | 'AT_RISK' | 'ON_TRACK';
	slaBadgeText: string;
	carrier: string;
	route: string;
	promisedAt: string;
	items: OrderItem[];
	reviewOriginalPt: string;
	reviewTranslatedEn: string;
	reviewRating: number;
	copilotSummary: string;
	thoughts: CopilotThought[];
	toolCalls: ToolCallBadge[];
	proposal: CreditProposal;
	/** Canonical 9-table Kaggle Olist + TiDB CQRS overlay fields */
	orderStatus?: OlistOrderStatus | string;
	lifecycle?: OrderLifecycle;
	customerUniqueId?: string;
	customerZipCodePrefix?: string;
	customerCity?: string;
	customerState?: string;
	payments?: OrderPayment[];
	reviewMeta?: OrderReviewMeta;
	courtesyCreditBrl?: number;
	source?: 'tidb' | 'fallback';
}

export interface ToastMessage {
	id: number;
	variant: 'amber' | 'error';
	title: string;
	detail: string;
}

export interface IssueCreditPayload {
	orderId: string;
	orderUuid?: string;
	customerId: string;
	amountBrl: number;
	reason: string;
	token: string | null;
}

export type IssueCreditRequest = IssueCreditPayload;

export interface IssueCreditResult {
	commandId: string;
	orderId: string;
	customerId: string;
	amountBrl: number;
	status: string;
	issuedAt: string;
}

export type CommandErrorCode =
	| 'UNAUTHORIZED'
	| 'INVALID_INPUT'
	| 'NETWORK_ERROR'
	| 'HTTP_ERROR'
	| 'INVALID_RESPONSE';

export class CommandError extends Error {
	readonly status: number;
	readonly code: CommandErrorCode;

	constructor(message: string, status = 0, code: CommandErrorCode = 'HTTP_ERROR') {
		super(message);
		this.name = 'CommandError';
		this.status = status;
		this.code = code;
	}
}

interface RawCommandResponse {
	commandId?: string;
	command_id?: string;
	orderId?: string;
	order_id?: string;
	customerId?: string;
	customer_id?: string;
	amountBrl?: number;
	amount_brl?: number;
	status?: string;
	issuedAt?: string;
	issued_at?: string;
	timestamp?: string;
	message?: string;
	error?: string;
	detail?: string;
}

const COMMAND_TIMEOUT_MS = 15_000;

function isAbortError(err: unknown): boolean {
	return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError';
}

export async function issueCourtesyCredit(
	payload: IssueCreditPayload,
	fetcher: typeof fetch = (...args) => globalThis.fetch(...args)
): Promise<IssueCreditResult> {
	const orderId = typeof payload.orderId === 'string' ? payload.orderId.trim() : '';
	const orderUuid = typeof payload.orderUuid === 'string' ? payload.orderUuid.trim() : '';
	const customerId = typeof payload.customerId === 'string' ? payload.customerId.trim() : '';
	const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
	const token = typeof payload.token === 'string' ? payload.token.trim() : '';
	const amountCents = Number.isFinite(payload.amountBrl) ? Math.round(payload.amountBrl * 100) : 0;

	if (
		!orderId ||
		!customerId ||
		reason.length < 3 ||
		reason.length > 500 ||
		!Number.isFinite(payload.amountBrl) ||
		payload.amountBrl <= 0 ||
		amountCents <= 0
	) {
		throw new CommandError(
			'Order ID, customer ID, positive credit amount, and reason (3-500 chars) are required.',
			400,
			'INVALID_INPUT'
		);
	}

	if (!token) {
		throw new CommandError('Operator bearer token is missing. Please sign in again.', 401, 'UNAUTHORIZED');
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), COMMAND_TIMEOUT_MS);

	try {
		let response: Response;
		try {
			response = await fetcher('/api/v1/commands/orders/issue-credit', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					order_id: orderUuid || orderId,
					amount_cents: amountCents,
					reason
				}),
				signal: controller.signal
			});
		} catch (err) {
			if (isAbortError(err)) {
				throw new CommandError('Credit command timed out. Please try again.', 408, 'NETWORK_ERROR');
			}
			throw new CommandError(
				'Unable to reach command service. Please check your connection and try again.',
				0,
				'NETWORK_ERROR'
			);
		}

		if (!response.ok) {
			let errorData: RawCommandResponse | null = null;
			try {
				const parsedError: unknown = await response.json();
				if (parsedError && typeof parsedError === 'object' && !Array.isArray(parsedError)) {
					errorData = parsedError as RawCommandResponse;
				}
			} catch (err) {
				if (isAbortError(err)) {
					throw new CommandError('Credit command timed out. Please try again.', 408, 'NETWORK_ERROR');
				}
				errorData = null;
			}
			const rawMessage = errorData?.message ?? errorData?.detail ?? errorData?.error;
			const serverMessage =
				typeof rawMessage === 'string' && rawMessage.trim().length > 0
					? rawMessage.trim()
					: undefined;

			if (response.status === 401 || response.status === 403) {
				throw new CommandError(
					serverMessage || 'Unauthorized to issue courtesy credit.',
					response.status,
					'UNAUTHORIZED'
				);
			}

			throw new CommandError(
				serverMessage || `Credit command failed with status ${response.status}.`,
				response.status,
				'HTTP_ERROR'
			);
		}

		let parsed: unknown;
		try {
			parsed = await response.json();
		} catch (err) {
			if (isAbortError(err)) {
				throw new CommandError('Credit command timed out. Please try again.', 408, 'NETWORK_ERROR');
			}
			throw new CommandError(
				'Command endpoint returned an invalid response.',
				response.status,
				'INVALID_RESPONSE'
			);
		}

		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new CommandError(
				'Command endpoint returned an invalid response.',
				response.status,
				'INVALID_RESPONSE'
			);
		}

		const data = parsed as RawCommandResponse;
		const rawAmount = data.amountBrl ?? data.amount_brl;
		const amountBrl =
			typeof rawAmount === 'number' && Number.isFinite(rawAmount) && rawAmount > 0
				? rawAmount
				: payload.amountBrl;

		return {
			commandId: data.commandId ?? data.command_id ?? `cmd-${orderId}`,
			orderId: data.orderId ?? data.order_id ?? orderId,
			customerId: data.customerId ?? data.customer_id ?? customerId,
			amountBrl,
			status: data.status ?? 'ISSUED',
			issuedAt: data.issuedAt ?? data.issued_at ?? data.timestamp ?? new Date().toISOString()
		};
	} finally {
		clearTimeout(timeoutId);
	}
}

interface RawOrderSummary {
	order_id: string;
	customer_id: string;
	status: string;
	total_amount_cents: number;
	currency: string;
	created_at: string;
}

interface RawOrderListResponse {
	orders: RawOrderSummary[];
	total_count: number;
	limit: number;
	offset: number;
}

interface RawOrderItem {
	item_id: string;
	product_id: string;
	price_cents: number;
	quantity: number;
	seller_id?: string | null;
	seller_city?: string | null;
	seller_state?: string | null;
	freight_cents?: number | null;
	category_name?: string | null;
	category_english?: string | null;
	shipping_limit_date?: string | null;
}

interface RawOrderPayment {
	payment_sequential: number;
	payment_type: string;
	payment_installments: number;
	payment_value_cents: number;
}

interface RawOrderReview {
	review_id: string;
	review_score: number;
	review_comment_title?: string | null;
	review_comment_message?: string | null;
	review_creation_date?: string | null;
	review_answer_timestamp?: string | null;
}

interface RawOrderDetails {
	order_id: string;
	customer_id: string;
	status: string;
	total_amount_cents: number;
	currency: string;
	items: RawOrderItem[];
	created_at: string;
	updated_at: string;
	order_purchase_timestamp?: string | null;
	order_approved_at?: string | null;
	order_delivered_carrier_date?: string | null;
	order_delivered_customer_date?: string | null;
	order_estimated_delivery_date?: string | null;
	courtesy_credit_cents?: number | null;
	customer_unique_id?: string | null;
	customer_zip_code_prefix?: string | null;
	customer_city?: string | null;
	customer_state?: string | null;
	payments?: RawOrderPayment[];
	review?: RawOrderReview | null;
}

function buildAuthHeaders(token: string | null): Record<string, string> {
	const trimmed = typeof token === 'string' ? token.trim() : '';
	return trimmed ? { Authorization: `Bearer ${trimmed}` } : {};
}

export function mapApiOrderDetailsToCase(raw: RawOrderDetails): OrderCase {
	const purchaseTs = raw.order_purchase_timestamp ?? raw.created_at;
	const estimatedTs = raw.order_estimated_delivery_date ?? raw.updated_at;
	const deliveredTs = raw.order_delivered_customer_date ?? null;

	let slaStatus: 'BREACHED' | 'AT_RISK' | 'ON_TRACK' = 'ON_TRACK';
	let slaBadgeText = `STATUS: ${raw.status.toUpperCase()}`;

	if (raw.status === 'canceled' || raw.status === 'unavailable') {
		slaStatus = 'BREACHED';
		slaBadgeText = `${raw.status.toUpperCase()} · TiDB`;
	} else if (estimatedTs) {
		const estMs = Date.parse(estimatedTs);
		const refMs = deliveredTs ? Date.parse(deliveredTs) : Date.now();
		if (Number.isFinite(estMs) && Number.isFinite(refMs)) {
			const diffDays = (refMs - estMs) / (1000 * 60 * 60 * 24);
			if (diffDays > 2) {
				slaStatus = 'BREACHED';
				slaBadgeText = `SLA BREACHED (+${diffDays.toFixed(1)} Days)`;
			} else if (diffDays > 0) {
				slaStatus = 'AT_RISK';
				slaBadgeText = `AT RISK (+${diffDays.toFixed(1)} Days)`;
			} else {
				slaStatus = 'ON_TRACK';
				slaBadgeText = deliveredTs ? 'DELIVERED ON TIME' : 'ON TRACK';
			}
		}
	}

	const items: OrderItem[] = (raw.items ?? []).map((item) => ({
		sku: item.item_id,
		productId: item.product_id,
		name: item.category_english
			? `${item.category_english.replace(/_/g, ' ')} (${item.product_id.slice(0, 8)})`
			: `Product ${item.product_id.slice(0, 12)}`,
		category: item.category_name ?? 'olist_catalog',
		categoryEnglish: item.category_english ?? undefined,
		quantity: item.quantity || 1,
		unitPriceBrl: item.price_cents / 100,
		freightValueBrl:
			typeof item.freight_cents === 'number' ? item.freight_cents / 100 : undefined,
		sellerId: item.seller_id ?? undefined,
		sellerCity: item.seller_city ?? undefined,
		sellerState: item.seller_state ?? undefined,
		shippingLimitDate: item.shipping_limit_date ?? null
	}));

	const payments: OrderPayment[] = (raw.payments ?? []).map((p) => ({
		paymentSequential: p.payment_sequential,
		paymentType: p.payment_type,
		paymentInstallments: p.payment_installments,
		paymentValueBrl: p.payment_value_cents / 100
	}));

	const totalBrl = raw.total_amount_cents / 100;
	const sellerOrigin =
		items[0]?.sellerCity && items[0]?.sellerState
			? `${items[0].sellerCity} (${items[0].sellerState})`
			: 'Olist Seller Hub';
	const customerDest =
		raw.customer_city && raw.customer_state
			? `${raw.customer_city} (${raw.customer_state})`
			: 'Brazil';

	const reviewMessage =
		raw.review?.review_comment_message?.trim() ||
		'Nenhum comentário registrado na tabela olist_order_reviews para este pedido.';
	const reviewScore = raw.review?.review_score ?? 5;
	const suggestedCredit = slaStatus === 'BREACHED' ? 20.0 : 10.0;

	return {
		orderId: raw.order_id,
		orderUuid: raw.order_id,
		customerId: raw.customer_id,
		customerUniqueId: raw.customer_unique_id ?? undefined,
		customerZipCodePrefix: raw.customer_zip_code_prefix ?? undefined,
		customerCity: raw.customer_city ?? undefined,
		customerState: raw.customer_state ?? undefined,
		customerName: raw.customer_city
			? `Customer ${raw.customer_id.slice(0, 8)} (${raw.customer_state ?? 'BR'})`
			: `Customer ${raw.customer_id.slice(0, 8)}`,
		customerTier: 'TiDB Live · Olist',
		customerLtvBrl: totalBrl,
		tenant: raw.customer_state ? `${raw.customer_state}-01` : 'SP-01',
		orderStatus: raw.status,
		slaStatus,
		slaBadgeText,
		carrier: 'Olist Logistics · TiDB HTAP',
		route: `${sellerOrigin} → ${customerDest}`,
		promisedAt: estimatedTs,
		lifecycle: {
			purchaseTimestamp: purchaseTs,
			approvedAt: raw.order_approved_at ?? null,
			deliveredCarrierDate: raw.order_delivered_carrier_date ?? null,
			deliveredCustomerDate: deliveredTs,
			estimatedDeliveryDate: estimatedTs
		},
		items,
		payments,
		reviewOriginalPt: reviewMessage,
		reviewTranslatedEn: raw.review?.review_comment_message?.trim()
			? `[PT-BR Review · ${reviewScore}/5] ${reviewMessage}`
			: 'No customer comment recorded in olist_order_reviews for this order.',
		reviewRating: reviewScore,
		reviewMeta: raw.review
			? {
					reviewId: raw.review.review_id,
					score: raw.review.review_score,
					title: raw.review.review_comment_title ?? null,
					creationDate: raw.review.review_creation_date ?? null,
					answerTimestamp: raw.review.review_answer_timestamp ?? null
				}
			: undefined,
		courtesyCreditBrl:
			typeof raw.courtesy_credit_cents === 'number'
				? raw.courtesy_credit_cents / 100
				: 0,
		copilotSummary: `Live TiDB order ${raw.order_id.slice(0, 12)} (${raw.status}) hydrated across 9-table Olist schema. ${items.length} item(s), ${payments.length} payment leg(s).`,
		thoughts: [
			{
				id: `th-tidb-${raw.order_id.slice(0, 6)}`,
				step: 'Query TiDB 9-table Olist transactional view',
				detail: `Joined olist_orders, olist_order_items (${items.length}), olist_order_payments (${payments.length}), olist_customers, and olist_order_reviews.`,
				durationMs: 14
			}
		],
		toolCalls: [
			{ id: `tc-tidb-${raw.order_id.slice(0, 6)}`, tool: 'tidb.olist.get_order', status: 'ok', latencyMs: 14 }
		],
		proposal: {
			id: `prop-${raw.order_id.slice(0, 8)}`,
			amountBrl: suggestedCredit,
			formattedAmount: `R$ ${suggestedCredit.toFixed(2).replace('.', ',')}`,
			reason: `Olist order ${raw.order_id.slice(0, 12)} SLA / goodwill concession`,
			policyCode: 'OLIST-SLA-T1'
		},
		source: 'tidb'
	};
}

export async function fetchOrders(
	token: string | null,
	options: { limit?: number; offset?: number; status?: string } = {},
	fetcher: typeof fetch = (...args) => globalThis.fetch(...args)
): Promise<{ orders: RawOrderSummary[]; totalCount: number }> {
	const params = new URLSearchParams();
	if (options.limit !== undefined) params.set('limit', String(options.limit));
	if (options.offset !== undefined) params.set('offset', String(options.offset));
	if (options.status) params.set('status', options.status);
	const qs = params.toString();
	const response = await fetcher(`/api/v1/orders${qs ? `?${qs}` : ''}`, {
		method: 'GET',
		headers: buildAuthHeaders(token)
	});
	if (!response.ok) {
		throw new CommandError(`Failed to fetch orders (${response.status})`, response.status, 'HTTP_ERROR');
	}
	const data = (await response.json()) as RawOrderListResponse;
	return {
		orders: Array.isArray(data.orders) ? data.orders : [],
		totalCount: typeof data.total_count === 'number' ? data.total_count : 0
	};
}

export async function fetchOrderDetails(
	orderId: string,
	token: string | null,
	fetcher: typeof fetch = (...args) => globalThis.fetch(...args)
): Promise<OrderCase> {
	const response = await fetcher(`/api/v1/orders/${encodeURIComponent(orderId)}`, {
		method: 'GET',
		headers: buildAuthHeaders(token)
	});
	if (!response.ok) {
		throw new CommandError(`Failed to fetch order ${orderId} (${response.status})`, response.status, 'HTTP_ERROR');
	}
	const raw = (await response.json()) as RawOrderDetails;
	return mapApiOrderDetailsToCase(raw);
}

export async function fetchOlistTableStats(
	token: string | null = null,
	fetcher: typeof fetch = (...args) => globalThis.fetch(...args)
): Promise<OlistTablesResponse> {
	const response = await fetcher('/api/v1/olist/tables', {
		method: 'GET',
		headers: buildAuthHeaders(token)
	});
	if (!response.ok) {
		throw new CommandError(`Failed to fetch TiDB Olist table stats (${response.status})`, response.status, 'HTTP_ERROR');
	}
	const raw = (await response.json()) as {
		storage_engine?: string;
		total_rows?: number;
		tables?: Array<{
			table_name: string;
			role: string;
			ingestion_mode: string;
			row_count: number;
			status: string;
		}>;
	};
	return {
		storageEngine: raw.storage_engine ?? 'tidb',
		totalRows: typeof raw.total_rows === 'number' ? raw.total_rows : 0,
		tables: (raw.tables ?? []).map((t) => ({
			tableName: t.table_name,
			role: t.role,
			ingestionMode: t.ingestion_mode,
			rowCount: t.row_count,
			status: t.status === 'synced' ? 'synced' : 'empty'
		}))
	};
}
