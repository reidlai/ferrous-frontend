<script lang="ts">
	import { untrack } from 'svelte';
	import AnalyticsScreen from '$lib/components/AnalyticsScreen.svelte';
	import InvestigationScreen from '$lib/components/InvestigationScreen.svelte';
	import Menubar from '$lib/components/Menubar.svelte';
	import RadarScreen from '$lib/components/RadarScreen.svelte';
	import SimulatorScreen from '$lib/components/SimulatorScreen.svelte';
	import { investigationStore } from '$lib/stores/investigation.svelte';
	import { radarStore } from '$lib/stores/radar.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { normalizePath, workspace } from '$lib/stores/workspace.svelte';

	interface StudioShellProps {
		initialPath?: string;
		sessionStore?: typeof session;
		workspaceStore?: typeof workspace;
	}

	let {
		initialPath,
		sessionStore = session,
		workspaceStore = workspace
	}: StudioShellProps = $props();

	let lastSyncedInitialPath = $state<string | undefined>(undefined);
	let lastAuthenticated = untrack(() => sessionStore.authenticated);
	let lastTenant = untrack(() => sessionStore.tenant);

	$effect(() => {
		const auth = sessionStore.authenticated;
		const tenant = sessionStore.tenant;
		if (auth !== lastAuthenticated || tenant !== lastTenant) {
			lastAuthenticated = auth;
			lastTenant = tenant;
			investigationStore.reset();
			radarStore.reset();
		}
	});

	$effect(() => {
		if (initialPath && initialPath !== lastSyncedInitialPath) {
			lastSyncedInitialPath = initialPath;
			workspaceStore.setCurrentPath(initialPath);
		}
	});

	const activePath = $derived(
		initialPath && initialPath !== lastSyncedInitialPath
			? normalizePath(initialPath)
			: workspaceStore.currentPath
	);
</script>

<div
	data-testid="resolution-studio-shell"
	class="flex min-h-screen flex-col bg-[#09090b] text-zinc-100"
>
	<Menubar {sessionStore} {workspaceStore} />

	<main class="flex flex-1 flex-col">
		{#if activePath === '/benchmarks'}
			<section
				data-testid="screen-benchmarks"
				aria-label="LLM Benchmarks"
				class="flex-1 p-6"
			>
				<div class="flex items-center justify-between border-b border-zinc-800 pb-4">
					<div>
						<h1 class="text-lg font-semibold text-zinc-50">LLM Benchmarks</h1>
						<p class="mt-1 text-xs text-zinc-400">
							Model latency, TTFT ({workspaceStore.ttftMs}ms), and token throughput telemetry.
						</p>
					</div>
					<span
						class="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 font-mono text-xs text-purple-300"
					>
						⚡ {workspaceStore.ttftMs}ms TTFT
					</span>
				</div>
			</section>
		{:else if activePath === '/pipeline-performance'}
			<section
				data-testid="screen-pipeline-performance"
				aria-label="Pipeline Performance"
				class="flex-1 p-6"
			>
				<div class="flex items-center justify-between border-b border-zinc-800 pb-4">
					<div>
						<h1 class="text-lg font-semibold text-zinc-50">Pipeline Performance</h1>
						<p class="mt-1 text-xs text-zinc-400">
							Ingestion WAL latency ({workspaceStore.walLatencyMs}ms) and Redpanda stream topology.
						</p>
					</div>
					<span
						class="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 font-mono text-xs text-blue-300"
					>
						⚡ {workspaceStore.walLatencyMs}ms WAL
					</span>
				</div>
			</section>
		{:else if activePath === '/radar'}
			<RadarScreen {workspaceStore} />
		{:else if activePath === '/analytics'}
			<AnalyticsScreen />
		{:else if activePath === '/simulator'}
			<SimulatorScreen />
		{:else}
			<InvestigationScreen {sessionStore} />
		{/if}
	</main>
</div>
