import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginCard from './LoginCard.svelte';
import { createSessionStore, REMEMBERED_USERNAME_KEY } from '$lib/stores/session.svelte';
import Page from '../../routes/+page.svelte';
import { session } from '$lib/stores/session.svelte';

describe('LoginCard', () => {
	beforeEach(() => {
		window.localStorage.clear();
		window.sessionStorage.clear();
		session.setRememberMe(false);
		session.logout();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders screen-login on #09090b canvas with required fields and zero demo persona shortcuts', () => {
		const store = createSessionStore();
		render(LoginCard, { props: { sessionStore: store } });

		const screenEl = screen.getByTestId('screen-login');
		expect(screenEl).toBeInTheDocument();
		expect(screenEl.className).toContain('bg-[#09090b]');

		const usernameInput = screen.getByLabelText(/^username$/i) as HTMLInputElement;
		const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
		const toggleBtn = screen.getByRole('button', { name: /toggle password visibility/i });
		const rememberCheckbox = screen.getByRole('checkbox', {
			name: /remember operator username/i
		});
		const submitBtn = screen.getByRole('button', { name: /sign in/i });

		expect(usernameInput.value).toBe('');
		expect(passwordInput.value).toBe('');
		expect(passwordInput.type).toBe('password');
		expect(toggleBtn).toBeInTheDocument();
		expect(rememberCheckbox).not.toBeChecked();
		expect(submitBtn).toBeInTheDocument();

		// Ensure no demo persona shortcut buttons or pre-filled demo credentials exist.
		expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/carlos\.support/i)).not.toBeInTheDocument();
		expect(screen.getAllByRole('button')).toHaveLength(2);
	});

	it('toggles password input type between password and text', async () => {
		const store = createSessionStore();
		render(LoginCard, { props: { sessionStore: store } });

		const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
		const toggleBtn = screen.getByRole('button', { name: /toggle password visibility/i });

		expect(passwordInput.type).toBe('password');
		await fireEvent.click(toggleBtn);
		expect(passwordInput.type).toBe('text');
		await fireEvent.click(toggleBtn);
		expect(passwordInput.type).toBe('password');
	});

	it('authenticates carlos.support, updates $state session in memory, and invokes onSuccess', async () => {
		const store = createSessionStore();
		const onSuccess = vi.fn();
		const mockFetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					token: 'jwt-carlos-token',
					username: 'carlos.support',
					role: 'customer_specialist',
					tenant: 'ferrous-br'
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		) as unknown as typeof fetch;

		render(LoginCard, {
			props: { fetcher: mockFetch, sessionStore: store, onSuccess }
		});

		await fireEvent.input(screen.getByLabelText(/^username$/i), {
			target: { value: 'carlos.support' }
		});
		await fireEvent.input(screen.getByLabelText(/^password$/i), {
			target: { value: 'operator-pass' }
		});
		await fireEvent.click(screen.getByRole('checkbox', { name: /remember operator username/i }));
		await fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

		await waitFor(() => {
			expect(onSuccess).toHaveBeenCalledTimes(1);
		});

		expect(mockFetch).toHaveBeenCalledWith(
			'/api/v1/auth/basic',
			expect.objectContaining({ method: 'POST' })
		);
		expect(store.authenticated).toBe(true);
		expect(store.token).toBe('jwt-carlos-token');
		expect(store.username).toBe('carlos.support');
		expect(store.role).toBe('customer_specialist');
		expect(store.tenant).toBe('ferrous-br');
		expect(JSON.stringify(window.localStorage)).not.toContain('jwt-carlos-token');
	});

	it('renders inline destructive role="alert" on 401 invalid credentials without crashing', async () => {
		const store = createSessionStore();
		const mockFetch = vi.fn(async () =>
			new Response(JSON.stringify({ message: 'Invalid operator credentials' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			})
		) as unknown as typeof fetch;

		render(LoginCard, { props: { fetcher: mockFetch, sessionStore: store } });

		await fireEvent.input(screen.getByLabelText(/^username$/i), {
			target: { value: 'carlos.support' }
		});
		await fireEvent.input(screen.getByLabelText(/^password$/i), {
			target: { value: 'bad-password' }
		});
		await fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Invalid operator credentials');
		expect(store.authenticated).toBe(false);
		expect(store.token).toBeNull();
	});

	it('renders inline destructive role="alert" on network failure without crashing', async () => {
		const store = createSessionStore();
		const mockFetch = vi.fn(async () => {
			throw new Error('Network down');
		}) as unknown as typeof fetch;

		render(LoginCard, { props: { fetcher: mockFetch, sessionStore: store } });

		await fireEvent.input(screen.getByLabelText(/^username$/i), {
			target: { value: 'carlos.support' }
		});
		await fireEvent.input(screen.getByLabelText(/^password$/i), {
			target: { value: 'operator-pass' }
		});
		await fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent(/unable to reach authentication service/i);
		expect(store.authenticated).toBe(false);
	});

	it('transitions +page.svelte from screen-login to resolution-studio-shell when authenticated', async () => {
		render(Page);

		expect(screen.getByTestId('screen-login')).toBeInTheDocument();
		expect(screen.queryByTestId('resolution-studio-shell')).not.toBeInTheDocument();

		session.login({
			token: 'jwt-shell-token',
			username: 'carlos.support',
			role: 'customer_specialist',
			tenant: 'ferrous-br'
		});

		await waitFor(() => {
			expect(screen.getByTestId('resolution-studio-shell')).toBeInTheDocument();
		});
		expect(screen.queryByTestId('screen-login')).not.toBeInTheDocument();
		expect(screen.getByTestId('operator-username')).toHaveTextContent('carlos.support');
	});

	it('shows validation alert and does not call fetcher on empty or whitespace submission', async () => {
		const store = createSessionStore();
		const mockFetch = vi.fn() as unknown as typeof fetch;

		render(LoginCard, { props: { fetcher: mockFetch, sessionStore: store } });

		await fireEvent.input(screen.getByLabelText(/^username$/i), {
			target: { value: '   ' }
		});
		await fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Username and password are required.');
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('syncs rememberMe checkbox toggle with sessionStore and clears persisted username when unchecked', async () => {
		window.localStorage.setItem(REMEMBERED_USERNAME_KEY, 'carlos.support');
		const store = createSessionStore();

		render(LoginCard, { props: { sessionStore: store } });

		const checkbox = screen.getByRole('checkbox', {
			name: /remember operator username/i
		}) as HTMLInputElement;
		expect(checkbox).toBeChecked();
		expect(window.localStorage.getItem(REMEMBERED_USERNAME_KEY)).toBe('carlos.support');

		await fireEvent.click(checkbox);
		expect(checkbox).not.toBeChecked();
		expect(store.rememberMe).toBe(false);
		expect(window.localStorage.getItem(REMEMBERED_USERNAME_KEY)).toBeNull();
	});

	it('guards against double submission while authenticating', async () => {
		const store = createSessionStore();
		let resolveFetch!: (value: Response) => void;
		const mockFetch = vi.fn(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				})
		) as unknown as typeof fetch;

		const { container } = render(LoginCard, {
			props: { fetcher: mockFetch, sessionStore: store }
		});

		await fireEvent.input(screen.getByLabelText(/^username$/i), {
			target: { value: 'carlos.support' }
		});
		await fireEvent.input(screen.getByLabelText(/^password$/i), {
			target: { value: 'operator-pass' }
		});

		const form = container.querySelector('form')!;
		await fireEvent.submit(form);

		expect(await screen.findByText('Authenticating...')).toBeInTheDocument();

		await fireEvent.submit(form);
		expect(mockFetch).toHaveBeenCalledTimes(1);

		resolveFetch(
			new Response(
				JSON.stringify({
					token: 'jwt-double-submit',
					username: 'carlos.support',
					role: 'customer_specialist',
					tenant: 'ferrous-br'
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		await waitFor(() => {
			expect(store.authenticated).toBe(true);
		});
	});

	it('invokes onSuccess callback and clears password and showPassword on login', async () => {
		const store = createSessionStore();
		const onSuccess = vi.fn();
		const mockFetch = vi.fn(async () =>
			new Response(
				JSON.stringify({
					token: 'jwt-callback-token',
					username: 'carlos.support',
					role: 'customer_specialist',
					tenant: 'ferrous-br'
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		) as unknown as typeof fetch;

		render(LoginCard, {
			props: { fetcher: mockFetch, sessionStore: store, onSuccess }
		});

		const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
		const toggleBtn = screen.getByRole('button', { name: /toggle password visibility/i });

		await fireEvent.input(screen.getByLabelText(/^username$/i), {
			target: { value: 'carlos.support' }
		});
		await fireEvent.input(passwordInput, {
			target: { value: 'secret-pass' }
		});
		await fireEvent.click(toggleBtn);
		expect(passwordInput.type).toBe('text');

		await fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

		await waitFor(() => {
			expect(onSuccess).toHaveBeenCalledWith({
				token: 'jwt-callback-token',
				username: 'carlos.support',
				role: 'customer_specialist',
				tenant: 'ferrous-br'
			});
		});

		expect(passwordInput.value).toBe('');
		expect(passwordInput.type).toBe('password');
	});

	it('completes end-to-end <Page /> login into 3-column resolution-studio-shell and signs out back to screen-login', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					token: 'jwt-e2e-token',
					username: 'carlos.support',
					role: 'customer_specialist',
					tenant: 'ferrous-br'
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		render(Page);

		expect(screen.getByTestId('screen-login')).toBeInTheDocument();

		await fireEvent.input(screen.getByLabelText(/^username$/i), {
			target: { value: 'carlos.support' }
		});
		await fireEvent.input(screen.getByLabelText(/^password$/i), {
			target: { value: 'operator-pass' }
		});
		await fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

		const shell = await screen.findByTestId('resolution-studio-shell');
		expect(shell).toBeInTheDocument();
		expect(screen.getByTestId('investigation-left-queue')).toBeInTheDocument();
		expect(screen.getByTestId('investigation-middle-canvas')).toBeInTheDocument();
		expect(screen.getByTestId('investigation-right-copilot')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

		expect(await screen.findByTestId('screen-login')).toBeInTheDocument();
		expect(screen.queryByTestId('resolution-studio-shell')).not.toBeInTheDocument();
	});
});
