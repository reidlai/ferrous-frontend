<script lang="ts">
	import { untrack } from 'svelte';
	import AnalyticsScreen from '$lib/components/AnalyticsScreen.svelte';
	import BenchmarksScreen from '$lib/components/BenchmarksScreen.svelte';
	import InvestigationScreen from '$lib/components/InvestigationScreen.svelte';
	import Menubar from '$lib/components/Menubar.svelte';
	import PipelinePerformanceScreen from '$lib/components/PipelinePerformanceScreen.svelte';
	import RadarScreen from '$lib/components/RadarScreen.svelte';
	import SimulatorScreen from '$lib/components/SimulatorScreen.svelte';
	import { benchmarksStore } from '$lib/stores/benchmarks.svelte';
	import { investigationStore } from '$lib/stores/investigation.svelte';
	import { pipelineStore } from '$lib/stores/pipeline.svelte';
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
			benchmarksStore.reset();
			pipelineStore.reset();
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
			<BenchmarksScreen {sessionStore} />
		{:else if activePath === '/pipeline-performance'}
			<PipelinePerformanceScreen {sessionStore} />
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
