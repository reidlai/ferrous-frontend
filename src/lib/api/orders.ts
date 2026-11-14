export interface OrderItem {
	sku: string;
	name: string;
	category: string;
	quantity: number;
	unitPriceBrl: number;
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
