export interface AuthSession {
	token: string;
	username: string;
	role: string | null;
	tenant: string | null;
}

export type AuthErrorCode =
	| 'INVALID_INPUT'
	| 'INVALID_CREDENTIALS'
	| 'NETWORK_ERROR'
	| 'INVALID_RESPONSE'
	| 'HTTP_ERROR';

export class AuthError extends Error {
	readonly status: number;
	readonly code: AuthErrorCode;

	constructor(message: string, status = 0, code: AuthErrorCode = 'HTTP_ERROR') {
		super(message);
		this.name = 'AuthError';
		this.status = status;
		this.code = code;
	}
}

interface RawAuthResponse {
	token?: string;
	access_token?: string;
	username?: string;
	user?: string | { username?: string; role?: string; tenant?: string };
	role?: string;
	tenant?: string;
	message?: string;
	error?: string;
	detail?: string;
}

const AUTH_TIMEOUT_MS = 15_000;

function encodeBasicCredentials(username: string, password: string): string {
	const raw = `${username}:${password}`;
	const bytes = new TextEncoder().encode(raw);
	const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
	return btoa(binary);
}

export async function authenticateBasic(
	username: string,
	password: string,
	fetcher: typeof fetch = (...args) => globalThis.fetch(...args)
): Promise<AuthSession> {
	const trimmedUsername = username.trim();
	if (!trimmedUsername || !password) {
		throw new AuthError('Username and password are required.', 400, 'INVALID_INPUT');
	}
	if (trimmedUsername.includes(':')) {
		throw new AuthError('Username cannot contain ":".', 400, 'INVALID_INPUT');
	}

	const basicToken = encodeBasicCredentials(trimmedUsername, password);
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetcher('/api/v1/auth/basic', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Basic ${basicToken}`
			},
			body: JSON.stringify({
				username: trimmedUsername,
				password
			}),
			signal: controller.signal
		});
	} catch (err) {
		if (err instanceof Error && err.name === 'AbortError') {
			throw new AuthError(
				'Authentication request timed out. Please try again.',
				408,
				'NETWORK_ERROR'
			);
		}
		throw new AuthError(
			'Unable to reach authentication service. Please check your connection and try again.',
			0,
			'NETWORK_ERROR'
		);
	} finally {
		clearTimeout(timeoutId);
	}

	if (!response.ok) {
		let errorData: RawAuthResponse | null = null;
		try {
			errorData = (await response.json()) as RawAuthResponse;
		} catch {
			errorData = null;
		}
		const rawMessage = errorData?.message ?? errorData?.detail ?? errorData?.error;
		const serverMessage =
			typeof rawMessage === 'string' && rawMessage.trim().length > 0
				? rawMessage.trim()
				: undefined;
		if (response.status === 401 || response.status === 403) {
			throw new AuthError(
				serverMessage || 'Invalid operator credentials. Please verify your username and password.',
				response.status,
				'INVALID_CREDENTIALS'
			);
		}
		throw new AuthError(
			serverMessage || `Authentication failed with status ${response.status}.`,
			response.status,
			'HTTP_ERROR'
		);
	}

	let data: RawAuthResponse;
	try {
		data = (await response.json()) as RawAuthResponse;
	} catch {
		throw new AuthError(
			'Authentication endpoint returned an invalid response.',
			response.status,
			'INVALID_RESPONSE'
		);
	}

	const rawToken = data?.token ?? data?.access_token;
	const token = typeof rawToken === 'string' && rawToken.trim().length > 0 ? rawToken : null;
	if (!token) {
		throw new AuthError(
			'Authentication response did not include a bearer token.',
			502,
			'INVALID_RESPONSE'
		);
	}

	const userObj = typeof data?.user === 'object' && data.user !== null ? data.user : undefined;
	const resolvedUsername =
		data?.username ??
		(typeof data?.user === 'string' ? data.user : userObj?.username) ??
		trimmedUsername;
	const role = data?.role ?? userObj?.role ?? null;
	const tenant = data?.tenant ?? userObj?.tenant ?? null;

	return {
		token,
		username: resolvedUsername,
		role,
		tenant
	};
}
