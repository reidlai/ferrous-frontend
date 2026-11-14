import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionStore, REMEMBERED_USERNAME_KEY } from './session.svelte';

describe('session store', () => {
	beforeEach(() => {
		window.localStorage.clear();
		window.sessionStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('initializes unauthenticated with empty in-memory token', () => {
		const store = createSessionStore();

		expect(store.authenticated).toBe(false);
		expect(store.token).toBeNull();
		expect(store.username).toBe('');
		expect(store.role).toBeNull();
		expect(store.tenant).toBeNull();
		expect(store.rememberMe).toBe(false);
	});

	it('stores JWT token in memory only and never persists token to storage', () => {
		const store = createSessionStore();

		store.login({
			token: 'jwt-secret-token-123',
			username: 'carlos.support',
			role: 'customer_specialist',
			tenant: 'ferrous-br',
			rememberMe: true
		});

		expect(store.authenticated).toBe(true);
		expect(store.token).toBe('jwt-secret-token-123');
		expect(store.username).toBe('carlos.support');
		expect(store.role).toBe('customer_specialist');
		expect(store.tenant).toBe('ferrous-br');
		expect(store.rememberMe).toBe(true);

		expect(window.localStorage.getItem(REMEMBERED_USERNAME_KEY)).toBe('carlos.support');
		expect(JSON.stringify(window.localStorage)).not.toContain('jwt-secret-token-123');
		expect(JSON.stringify(window.sessionStorage)).not.toContain('jwt-secret-token-123');
	});

	it('hydrates remembered username from localStorage on creation', () => {
		window.localStorage.setItem(REMEMBERED_USERNAME_KEY, 'ana.ops');

		const store = createSessionStore();

		expect(store.authenticated).toBe(false);
		expect(store.token).toBeNull();
		expect(store.username).toBe('ana.ops');
		expect(store.rememberMe).toBe(true);
	});

	it('clears token and sensitive claims on logout while respecting rememberMe', () => {
		const store = createSessionStore();

		store.login({
			token: 'jwt-token-abc',
			username: 'carlos.support',
			role: 'customer_specialist',
			tenant: 'default',
			rememberMe: true
		});
		store.logout();

		expect(store.authenticated).toBe(false);
		expect(store.token).toBeNull();
		expect(store.role).toBeNull();
		expect(store.tenant).toBeNull();
		expect(store.username).toBe('carlos.support');
		expect(window.localStorage.getItem(REMEMBERED_USERNAME_KEY)).toBe('carlos.support');

		store.setRememberMe(false);
		store.logout();
		expect(store.username).toBe('');
		expect(window.localStorage.getItem(REMEMBERED_USERNAME_KEY)).toBeNull();
	});

	it('ignores whitespace-only localStorage entries on creation', () => {
		window.localStorage.setItem(REMEMBERED_USERNAME_KEY, '   \t\n  ');

		const store = createSessionStore();

		expect(store.username).toBe('');
		expect(store.rememberMe).toBe(false);
	});

	it('clears persisted username immediately when setRememberMe(false) is called', () => {
		window.localStorage.setItem(REMEMBERED_USERNAME_KEY, 'ana.ops');
		const store = createSessionStore();

		expect(store.rememberMe).toBe(true);
		expect(window.localStorage.getItem(REMEMBERED_USERNAME_KEY)).toBe('ana.ops');

		store.setRememberMe(false);

		expect(store.rememberMe).toBe(false);
		expect(window.localStorage.getItem(REMEMBERED_USERNAME_KEY)).toBeNull();
	});

	it('falls back gracefully when accessing localStorage throws SecurityError', () => {
		vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
			throw new DOMException('Access denied', 'SecurityError');
		});

		const store = createSessionStore();
		expect(store.username).toBe('');
		expect(store.rememberMe).toBe(false);

		expect(() =>
			store.login({
				token: 'jwt-token',
				username: 'carlos.support',
				rememberMe: true
			})
		).not.toThrow();
		expect(store.authenticated).toBe(true);
		expect(store.token).toBe('jwt-token');
		expect(store.tenant).toBe('SP-01');
	});

	it('defaults tenant to SP-01 when omitted on login and updates via setTenant', () => {
		const store = createSessionStore();

		store.login({
			token: 'jwt-default-tenant',
			username: 'carlos.support'
		});

		expect(store.tenant).toBe('SP-01');

		store.setTenant('RJ-01');
		expect(store.tenant).toBe('RJ-01');

		store.setTenant('MG-01');
		expect(store.tenant).toBe('MG-01');
	});
});
