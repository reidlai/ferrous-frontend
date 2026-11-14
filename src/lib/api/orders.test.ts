import { describe, expect, it, vi } from 'vitest';
import { CommandError, issueCourtesyCredit } from './orders';

describe('issueCourtesyCredit', () => {
	it('sends Bearer auth header and snake_case JSON payload to /api/v1/commands/orders/issue-credit', async () => {
		const mockFetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					command_id: 'cmd-94821',
					status: 'ACCEPTED',
					timestamp: '2026-11-14T02:30:00Z'
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		) as unknown as typeof fetch;

		const result = await issueCourtesyCredit(
			{
				orderId: 'OL-94821-SP',
				orderUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
				customerId: 'cust-olist-88412',
				amountBrl: 29.8,
				reason: 'SLA breach (+8.4 Days)',
				token: 'jwt-operator-token'
			},
			mockFetch
		);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = (mockFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toBe('/api/v1/commands/orders/issue-credit');
		expect(init.method).toBe('POST');
		expect(init.headers).toMatchObject({
			'Content-Type': 'application/json',
			Authorization: 'Bearer jwt-operator-token'
		});
		expect(JSON.parse(init.body as string)).toEqual({
			order_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
			amount_cents: 2980,
			reason: 'SLA breach (+8.4 Days)'
		});
		expect(init.signal).toBeInstanceOf(AbortSignal);
		expect(result).toEqual({
			commandId: 'cmd-94821',
			orderId: 'OL-94821-SP',
			customerId: 'cust-olist-88412',
			amountBrl: 29.8,
			status: 'ACCEPTED',
			issuedAt: '2026-11-14T02:30:00Z'
		});
	});

	it('throws CommandError UNAUTHORIZED when token is missing', async () => {
		const mockFetch = vi.fn() as unknown as typeof fetch;

		await expect(
			issueCourtesyCredit(
				{
					orderId: 'OL-94821-SP',
					customerId: 'cust-olist-88412',
					amountBrl: 29.8,
					reason: 'SLA breach',
					token: null
				},
				mockFetch
			)
		).rejects.toMatchObject({
			name: 'CommandError',
			status: 401,
			code: 'UNAUTHORIZED'
		});
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('throws CommandError INVALID_INPUT when amount is non-positive or fields are empty', async () => {
		const mockFetch = vi.fn() as unknown as typeof fetch;

		await expect(
			issueCourtesyCredit(
				{
					orderId: '',
					customerId: 'cust-1',
					amountBrl: 0,
					reason: 'SLA',
					token: 'jwt'
				},
				mockFetch
			)
		).rejects.toMatchObject({
			name: 'CommandError',
			status: 400,
			code: 'INVALID_INPUT'
		});
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('throws CommandError HTTP_ERROR on non-2xx server error', async () => {
		const mockFetch = vi.fn(async () =>
			new Response(JSON.stringify({ detail: 'Credit ledger unavailable' }), {
				status: 503,
				headers: { 'Content-Type': 'application/json' }
			})
		) as unknown as typeof fetch;

		await expect(
			issueCourtesyCredit(
				{
					orderId: 'OL-94821-SP',
					customerId: 'cust-olist-88412',
					amountBrl: 29.8,
					reason: 'SLA breach',
					token: 'jwt'
				},
				mockFetch
			)
		).rejects.toMatchObject({
			name: 'CommandError',
			status: 503,
			code: 'HTTP_ERROR',
			message: 'Credit ledger unavailable'
		});
	});

	it('throws CommandError NETWORK_ERROR on network failure and AbortError timeout', async () => {
		const networkFailFetch = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}) as unknown as typeof fetch;

		await expect(
			issueCourtesyCredit(
				{
					orderId: 'OL-94821-SP',
					customerId: 'cust-olist-88412',
					amountBrl: 29.8,
					reason: 'SLA breach',
					token: 'jwt'
				},
				networkFailFetch
			)
		).rejects.toBeInstanceOf(CommandError);

		const abortFetch = vi.fn(async () => {
			const err = new Error('The operation was aborted');
			err.name = 'AbortError';
			throw err;
		}) as unknown as typeof fetch;

		await expect(
			issueCourtesyCredit(
				{
					orderId: 'OL-94821-SP',
					customerId: 'cust-olist-88412',
					amountBrl: 29.8,
					reason: 'SLA breach',
					token: 'jwt'
				},
				abortFetch
			)
		).rejects.toMatchObject({
			name: 'CommandError',
			status: 408,
			code: 'NETWORK_ERROR'
		});
	});

	it('falls back to HTTP_ERROR when non-2xx response has non-JSON body (502 Bad Gateway)', async () => {
		const mockFetch = vi.fn(async () =>
			new Response('<html><body>502 Bad Gateway</body></html>', {
				status: 502,
				headers: { 'Content-Type': 'text/html' }
			})
		) as unknown as typeof fetch;

		await expect(
			issueCourtesyCredit(
				{
					orderId: 'OL-94821-SP',
					customerId: 'cust-olist-88412',
					amountBrl: 29.8,
					reason: 'SLA breach',
					token: 'jwt'
				},
				mockFetch
			)
		).rejects.toMatchObject({
			name: 'CommandError',
			status: 502,
			code: 'HTTP_ERROR',
			message: 'Credit command failed with status 502.'
		});
	});

	it('throws CommandError INVALID_RESPONSE when 200 OK returns null JSON', async () => {
		const mockFetch = vi.fn(async () =>
			new Response('null', {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		) as unknown as typeof fetch;

		await expect(
			issueCourtesyCredit(
				{
					orderId: 'OL-94821-SP',
					customerId: 'cust-olist-88412',
					amountBrl: 29.8,
					reason: 'SLA breach',
					token: 'jwt'
				},
				mockFetch
			)
		).rejects.toMatchObject({
			name: 'CommandError',
			status: 200,
			code: 'INVALID_RESPONSE'
		});
	});
});
