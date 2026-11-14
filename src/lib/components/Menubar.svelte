<script lang="ts">
	import { goto } from '$app/navigation';
	import { Activity, ExternalLink, Gauge, LogOut, Network, ShieldCheck } from 'lucide-svelte';
	import { session } from '$lib/stores/session.svelte';
	import { TENANT_OPTIONS, WORKSPACE_LINKS, workspace } from '$lib/stores/workspace.svelte';

	type DropdownId = 'workspaces' | 'replay' | 'diagnostics' | null;

	interface MenubarProps {
		sessionStore?: typeof session;
		workspaceStore?: typeof workspace;
		onNavigate?: (path: string) => unknown;
	}

	let {
		sessionStore = session,
		workspaceStore = workspace,
		onNavigate
	}: MenubarProps = $props();

	let openMenu = $state<DropdownId>(null);
	let menusContainerEl = $state<HTMLElement | null>(null);
	let menuTriggers: Record<Exclude<DropdownId, null>, HTMLButtonElement | null> = {
		workspaces: null,
		replay: null,
		diagnostics: null
	};

	const activeTenant = $derived(sessionStore.tenant ?? 'SP-01');
	const tenantOptions = $derived(
		sessionStore.tenant && !(TENANT_OPTIONS as readonly string[]).includes(sessionStore.tenant)
			? [sessionStore.tenant, ...TENANT_OPTIONS]
			: [...TENANT_OPTIONS]
	);

	function safeGoto(path: string): void {
		if (onNavigate) {
			Promise.resolve(workspaceStore.navigateTo(path, onNavigate)).catch(() => undefined);
			return;
		}
		Promise.resolve(
			workspaceStore.navigateTo(path, (target) => {
				try {
					return goto(target);
				} catch {
					// Ignore router-uninitialized errors in isolated unit tests.
					return undefined;
				}
			})
		).catch(() => undefined);
	}

	function navigate(path: string): void {
		openMenu = null;
		safeGoto(path);
	}

	function toggleMenu(id: Exclude<DropdownId, null>): void {
		openMenu = openMenu === id ? null : id;
	}

	function handleTenantChange(event: Event): void {
		const target = event.currentTarget as HTMLSelectElement;
		sessionStore.setTenant(target.value);
	}

	function isEditableTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) {
			return false;
		}
		const tag = target.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (!sessionStore.authenticated || event.repeat || event.isComposing) {
			return;
		}

		if (event.key === 'Escape') {
			if (openMenu) {
				const trigger = menuTriggers[openMenu];
				openMenu = null;
				trigger?.focus();
			}
			return;
		}

		if (isEditableTarget(event.target)) {
			return;
		}

		if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
			const key = event.key.toLowerCase();
			if (key === 'b') {
				event.preventDefault();
				navigate('/benchmarks');
			} else if (key === 'p') {
				event.preventDefault();
				navigate('/pipeline-performance');
			}
		}
	}

	function handleWindowClick(event: MouseEvent): void {
		if (openMenu && menusContainerEl && !menusContainerEl.contains(event.target as Node)) {
			openMenu = null;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleWindowClick} />

<header
	data-testid="app-menubar"
	class="relative z-30 flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 text-xs text-zinc-200"
>
	<div
		bind:this={menusContainerEl}
		role="menubar"
		aria-label="Application Menu Bar"
		class="flex items-center gap-1.5"
	>
		<button
			type="button"
			role="menuitem"
			onclick={() => navigate('/investigation')}
			class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold tracking-tight text-zinc-50 transition hover:bg-zinc-900"
		>
			<span aria-hidden="true">⚡</span>
			<span>FerrousCX</span>
		</button>

		<div class="relative">
			<button
				bind:this={menuTriggers.workspaces}
				type="button"
				role="menuitem"
				aria-haspopup="menu"
				aria-expanded={openMenu === 'workspaces'}
				onclick={() => toggleMenu('workspaces')}
				class="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
			>
				<span>Workspaces</span>
				<span aria-hidden="true">▾</span>
			</button>

			{#if openMenu === 'workspaces'}
				<div
					role="menu"
					aria-label="Workspaces"
					class="absolute left-0 top-full mt-1.5 w-48 rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-xl"
				>
					{#each WORKSPACE_LINKS as item (item.path)}
						<button
							type="button"
							role="menuitem"
							aria-current={workspaceStore.currentPath === item.path ? 'page' : undefined}
							onclick={() => navigate(item.path)}
							class="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition hover:bg-zinc-900 {workspaceStore.currentPath === item.path
								? 'bg-zinc-900 font-semibold text-zinc-50'
								: 'text-zinc-300'}"
						>
							<span>{item.label}</span>
							<span class="font-mono text-[10px] text-zinc-500">{item.path}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<button
			type="button"
			role="menuitem"
			aria-current={workspaceStore.currentPath === '/benchmarks' ? 'page' : undefined}
			onclick={() => navigate('/benchmarks')}
			class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition hover:bg-zinc-900 {workspaceStore.currentPath === '/benchmarks'
				? 'bg-zinc-900 text-zinc-50'
				: 'text-zinc-300'}"
		>
			<Gauge class="h-3.5 w-3.5 text-purple-400" aria-hidden="true" />
			<span>LLM Benchmarks</span>
			<span
				class="rounded-full border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 font-mono text-[11px] text-purple-300"
			>
				<span aria-hidden="true">⚡</span> {workspaceStore.ttftMs}ms TTFT
			</span>
		</button>

		<button
			type="button"
			role="menuitem"
			aria-current={workspaceStore.currentPath === '/pipeline-performance' ? 'page' : undefined}
			onclick={() => navigate('/pipeline-performance')}
			class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition hover:bg-zinc-900 {workspaceStore.currentPath === '/pipeline-performance'
				? 'bg-zinc-900 text-zinc-50'
				: 'text-zinc-300'}"
		>
			<Network class="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
			<span>Pipeline Performance</span>
			<span
				class="rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 font-mono text-[11px] text-blue-300"
			>
				<span aria-hidden="true">⚡</span> {workspaceStore.walLatencyMs}ms WAL
			</span>
		</button>

		<div class="relative">
			<button
				bind:this={menuTriggers.replay}
				type="button"
				role="menuitem"
				aria-expanded={openMenu === 'replay'}
				onclick={() => toggleMenu('replay')}
				class="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
			>
				<span>Replay</span>
				<span aria-hidden="true">▾</span>
			</button>

			{#if openMenu === 'replay'}
				<div
					role="region"
					aria-label="Replay status"
					class="absolute left-0 top-full mt-1.5 w-64 rounded-md border border-zinc-800 bg-zinc-950 p-3 shadow-xl"
				>
					<div class="flex items-center justify-between text-[11px] text-zinc-400">
						<span class="font-semibold uppercase tracking-wider">Replay Stream</span>
						<span class="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 capitalize text-emerald-300">
							{workspaceStore.replayStatus.mode}
						</span>
					</div>
					<dl class="mt-2 space-y-1.5 border-t border-zinc-800 pt-2 text-xs">
						<div class="flex items-center justify-between">
							<dt class="text-zinc-500">Stream</dt>
							<dd class="font-mono text-zinc-200">{workspaceStore.replayStatus.stream}</dd>
						</div>
						<div class="flex items-center justify-between">
							<dt class="text-zinc-500">Throughput</dt>
							<dd class="font-mono text-zinc-200">{workspaceStore.replayStatus.throughput}</dd>
						</div>
					</dl>
					<div class="mt-3 border-t border-zinc-800 pt-2">
						<a
							href={workspaceStore.replayStatus.quickstartUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline"
						>
							<span>ferrous-cx quickstart</span>
							<ExternalLink class="h-3 w-3" aria-hidden="true" />
						</a>
					</div>
				</div>
			{/if}
		</div>

		<div class="relative">
			<button
				bind:this={menuTriggers.diagnostics}
				type="button"
				role="menuitem"
				aria-expanded={openMenu === 'diagnostics'}
				onclick={() => toggleMenu('diagnostics')}
				class="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
			>
				<span>Diagnostics</span>
				<span aria-hidden="true">▾</span>
			</button>

			{#if openMenu === 'diagnostics'}
				<div
					role="region"
					aria-label="Diagnostics status"
					class="absolute left-0 top-full mt-1.5 w-60 rounded-md border border-zinc-800 bg-zinc-950 p-3 shadow-xl"
				>
					<div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
						<Activity class="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
						<span>System Diagnostics</span>
					</div>
					<dl class="mt-2 space-y-1.5 border-t border-zinc-800 pt-2 text-xs">
						<div class="flex items-center justify-between">
							<dt class="text-zinc-500">Health</dt>
							<dd class="font-mono text-emerald-400">OK (200)</dd>
						</div>
						<div class="flex items-center justify-between">
							<dt class="text-zinc-500">OTel GenAI</dt>
							<dd class="font-mono text-zinc-200">Tracing Active</dd>
						</div>
						<div class="flex items-center justify-between">
							<dt class="text-zinc-500">SSE Stream</dt>
							<dd class="font-mono text-zinc-200">Connected</dd>
						</div>
					</dl>
				</div>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-3">
		<label class="sr-only" for="tenant-selector">Tenant</label>
		<select
			id="tenant-selector"
			aria-label="Tenant"
			value={activeTenant}
			onchange={handleTenantChange}
			class="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 focus:border-zinc-600 focus:outline-none"
		>
			{#each tenantOptions as tenantOption (tenantOption)}
				<option value={tenantOption}>{tenantOption}</option>
			{/each}
		</select>

		<div class="flex items-center gap-1.5 text-zinc-300">
			<ShieldCheck class="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
			<span data-testid="operator-username">{sessionStore.username}</span>
			{#if sessionStore.role}
				<span class="rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-400">
					{sessionStore.role}
				</span>
			{/if}
		</div>

		<button
			type="button"
			onclick={() => sessionStore.logout()}
			class="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
		>
			<LogOut class="h-3.5 w-3.5" aria-hidden="true" />
			<span>Sign Out</span>
		</button>
	</div>
</header>
