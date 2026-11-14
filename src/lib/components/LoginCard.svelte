<script lang="ts">
	import { Eye, EyeOff, Lock, AlertCircle, Loader2 } from 'lucide-svelte';
	import { authenticateBasic, AuthError, type AuthSession } from '$lib/api/auth';
	import { session as defaultSession } from '$lib/stores/session.svelte';

	interface Props {
		fetcher?: typeof fetch;
		sessionStore?: typeof defaultSession;
		onSuccess?: (authSession: AuthSession) => void;
	}

	let {
		fetcher = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
		sessionStore = defaultSession,
		onSuccess
	}: Props = $props();

	let username = $state('');
	let password = $state('');
	let rememberMe = $state(false);
	let showPassword = $state(false);
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	$effect(() => {
		username = sessionStore.username;
	});

	$effect(() => {
		rememberMe = sessionStore.rememberMe;
	});

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;
		errorMessage = null;

		const trimmedUsername = username.trim();
		if (!trimmedUsername || !password) {
			errorMessage = 'Username and password are required.';
			return;
		}

		submitting = true;
		try {
			const authSession = await authenticateBasic(trimmedUsername, password, fetcher);
			sessionStore.login({
				token: authSession.token,
				username: authSession.username,
				role: authSession.role,
				tenant: authSession.tenant,
				rememberMe
			});
			password = '';
			showPassword = false;
			onSuccess?.(authSession);
		} catch (err) {
			if (err instanceof AuthError) {
				errorMessage = err.message;
			} else {
				errorMessage = 'An unexpected error occurred during authentication.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<main
	data-testid="screen-login"
	class="flex min-h-screen w-full items-center justify-center bg-[#09090b] px-4 py-12 text-zinc-100"
>
	<div
		class="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950/90 p-8 shadow-2xl shadow-black/60"
	>
		<header class="mb-7 space-y-2 text-center">
			<div
				class="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200"
			>
				<Lock class="h-5 w-5" aria-hidden="true" />
			</div>
			<p class="text-xs font-medium tracking-widest text-zinc-500 uppercase">FerrousCX</p>
			<h1 class="text-xl font-semibold tracking-tight text-zinc-50">Operator Sign In</h1>
			<p class="text-sm text-zinc-400">Authenticate to enter the Resolution Studio.</p>
		</header>

		{#if errorMessage}
			<div
				role="alert"
				class="mb-5 flex items-start gap-2.5 rounded-lg border border-red-900/70 bg-red-950/50 px-3.5 py-3 text-sm text-red-200"
			>
				<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
				<span>{errorMessage}</span>
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-4" novalidate>
			<div class="space-y-1.5">
				<label for="username" class="block text-xs font-medium text-zinc-300">Username</label>
				<input
					id="username"
					name="username"
					type="text"
					autocomplete="username"
					bind:value={username}
					disabled={submitting}
					placeholder="operator.username"
					class="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 transition outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
				/>
			</div>

			<div class="space-y-1.5">
				<label for="password" class="block text-xs font-medium text-zinc-300">Password</label>
				<div class="relative">
					<input
						id="password"
						name="password"
						type={showPassword ? 'text' : 'password'}
						autocomplete="current-password"
						bind:value={password}
						disabled={submitting}
						placeholder="••••••••••••"
						class="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pr-10 pl-3 text-sm text-zinc-100 placeholder-zinc-600 transition outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
					/>
					<button
						type="button"
						onclick={togglePasswordVisibility}
						aria-label="Toggle password visibility"
						aria-pressed={showPassword}
						disabled={submitting}
						class="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 transition hover:text-zinc-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if showPassword}
							<EyeOff class="h-4 w-4" aria-hidden="true" />
						{:else}
							<Eye class="h-4 w-4" aria-hidden="true" />
						{/if}
					</button>
				</div>
			</div>

			<div class="flex items-center justify-between pt-1">
				<label
					for="remember-me"
					class="flex cursor-pointer items-center gap-2 text-xs text-zinc-400 select-none"
				>
					<input
						id="remember-me"
						name="rememberMe"
						type="checkbox"
						bind:checked={rememberMe}
						onchange={() => sessionStore.setRememberMe(rememberMe)}
						disabled={submitting}
						class="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 accent-zinc-200 focus:ring-1 focus:ring-zinc-500"
					/>
					<span>Remember operator username</span>
				</label>
			</div>

			<button
				type="submit"
				disabled={submitting}
				class="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-[#09090b] disabled:cursor-not-allowed disabled:opacity-60"
			>
				{#if submitting}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					<span>Authenticating...</span>
				{:else}
					<span>Sign In</span>
				{/if}
			</button>
		</form>
	</div>
</main>
