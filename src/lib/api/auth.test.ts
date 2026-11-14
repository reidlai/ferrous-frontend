import { describe, expect, it, vi } from 'vitest';
import { authenticateBasic, AuthError } from './auth';

describe('authenticateBasic', () => {
	it('sends Basic auth header and JSON payload to /api/v1/auth/basic and returns AuthSession', async () => {
		const mockFetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					token: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
					username: 'carlos.support',
					role: 'customer_specialist',
					tenant: 'ferrous-prod'
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		) as unknown as typeof fetch;

		const result = await authenticateBasic('carlos.support', 's3cr3t!', mockFetch);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, init] = (mockFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toBe('/api/v1/auth/basic');
		expect(init.method).toBe('POST');
		expect(init.headers).toMatchObject({
			'Content-Type': 'application/json',
			Authorization: `Basic ${btoa('carlos.support:s3cr3t!')}`
		});
		expect(JSON.parse(init.body as string)).toEqual({
			username: 'carlos.support',
			password: 's3cr3t!'
		});
		expect(result).toEqual({
			token: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
			username: 'carlos.support',
			role: 'customer_specialist',
			tenant: 'ferrous-prod'
		});
	});

	it('supports access_token and nested user object responses', async () => {
		const mockFetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					access_token: 'nested-jwt-token',
					user: {
						username: 'maria.admin',
						role: 'system_admin',
						tenant: 'global'
					}
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		) as unknown as typeof fetch;

		const result = await authenticateBasic('maria.admin', 'pw', mockFetch);

		expect(result).toEqual({
			token: 'nested-jwt-token',
			username: 'maria.admin',
			role: 'system_admin',
			tenant: 'global'
		});
	});

	it('throws AuthError with INVALID_CREDENTIALS on 401 response', async () => {
		const mockFetch = vi.fn(async () =>
			new Response(JSON.stringify({ message: 'Invalid username or password' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			})
		) as unknown as typeof fetch;

		await expect(authenticateBasic('carlos.support', 'wrong', mockFetch)).rejects.toMatchObject({
			name: 'AuthError',
			status: 401,
			code: 'INVALID_CREDENTIALS',
			message: 'Invalid username or password'
		});
	});

	it('throws AuthError with NETWORK_ERROR when fetch rejects', async () => {
		const mockFetch = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}) as unknown as typeof fetch;

		await expect(authenticateBasic('carlos.support', 'pw', mockFetch)).rejects.toBeInstanceOf(
			AuthError
		);
		await expect(authenticateBasic('carlos.support', 'pw', mockFetch)).rejects.toMatchObject({
			status: 0,
			code: 'NETWORK_ERROR'
		});
	});

	it('throws AuthError with INVALID_INPUT when credentials are empty', async () => {
		const mockFetch = vi.fn() as unknown as typeof fetch;

		await expect(authenticateBasic('   ', 'pw', mockFetch)).rejects.toMatchObject({
			status: 400,
			code: 'INVALID_INPUT'
		});
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('throws AuthError with INVALID_RESPONSE when 200 payload lacks token', async () => {
		const mockFetch = vi.fn(async () =>
			new Response(JSON.stringify({ username: 'carlos.support' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		) as unknown as typeof fetch;

		await expect(authenticateBasic('carlos.support', 'pw', mockFetch)).rejects.toMatchObject({
			status: 502,
			code: 'INVALID_RESPONSE'
		});
	});

	it('throws AuthError with INVALID_RESPONSE when 200 response is non-JSON', async () => {
		const mockFetch = vi.fn(async () =>
			new Response('<html>OK</html>', {
				status: 200,
				headers: { 'Content-Type': 'text/html' }
			})
		) as unknown as typeof fetch;

		await expect(authenticateBasic('carlos.support', 'pw', mockFetch)).rejects.toMatchObject({
			name: 'AuthError',
			status: 200,
			code: 'INVALID_RESPONSE',
			message: 'Authentication endpoint returned an invalid response.'
		});
	});

	it('handles non-JSON 502 text/plain error body gracefully', async () => {
		const mockFetch = vi.fn(async () =>
			new Response('Bad Gateway', {
				status: 502,
				headers: { 'Content-Type': 'text/plain' }
			})
		) as unknown as typeof fetch;

		await expect(authenticateBasic('carlos.support', 'pw', mockFetch)).rejects.toMatchObject({
			name: 'AuthError',
			status: 502,
			code: 'HTTP_ERROR',
			message: 'Authentication failed with status 502.'
		});
	});

	it('supports { access_token, user } string fallback response shape', async () => {
		const mockFetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					access_token: 'fallback-jwt-token',
					user: 'ana.ops'
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		) as unknown as typeof fetch;

		const result = await authenticateBasic('ana.ops', 'pw', mockFetch);

		expect(result).toEqual({
			token: 'fallback-jwt-token',
			username: 'ana.ops',
			role: null,
			tenant: null
		});
	});

	it('encodes non-ASCII UTF-8 passwords properly in Basic auth header', async () => {
		const mockFetch = vi.fn(async () =>
			new Response(JSON.stringify({ token: 'utf8-token', username: 'carlos.support' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		) as unknown as typeof fetch;

		const utf8Password = 'p@ss-çãø-🔑';
		await authenticateBasic('carlos.support', utf8Password, mockFetch);

		const [, init] = (mockFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		const authHeader = (init.headers as Record<string, string>).Authorization;
		const encodedPart = authHeader.replace(/^Basic /, '');
		const decodedBytes = Uint8Array.from(atob(encodedPart), (c) => c.charCodeAt(0));
		const decoded = new TextDecoder().decode(decodedBytes);
		expect(decoded).toBe(`carlos.support:${utf8Password}`);
	});

	it('rejects username containing colon with INVALID_INPUT', async () => {
		const mockFetch = vi.fn() as unknown as typeof fetch;

		await expect(authenticateBasic('bad:user', 'pw', mockFetch)).rejects.toMatchObject({
			status: 400,
			code: 'INVALID_INPUT'
		});
		expect(mockFetch).not.toHaveBeenCalled();
	});
});
