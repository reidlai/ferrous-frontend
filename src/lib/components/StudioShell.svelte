<script lang="ts">
	import Menubar from '$lib/components/Menubar.svelte';
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
			<section data-testid="screen-radar" aria-label="Live Ops Radar" class="flex-1 p-6">
				<h1 class="text-lg font-semibold text-zinc-50">Live Ops Radar</h1>
				<p class="mt-1 text-xs text-zinc-400">
					Real-time regional SLA breach monitor for tenant {sessionStore.tenant ?? 'SP-01'}.
				</p>
			</section>
		{:else if activePath === '/analytics'}
			<section data-testid="screen-analytics" aria-label="SLA & Analytics" class="flex-1 p-6">
				<h1 class="text-lg font-semibold text-zinc-50">SLA &amp; Analytics</h1>
				<p class="mt-1 text-xs text-zinc-400">
					Historical SLA compliance and carrier performance metrics.
				</p>
			</section>
		{:else if activePath === '/simulator'}
			<section data-testid="screen-simulator" aria-label="Simulator" class="flex-1 p-6">
				<h1 class="text-lg font-semibold text-zinc-50">Simulator</h1>
				<p class="mt-1 text-xs text-zinc-400">
					What-if disruption scenarios and agent policy evaluation.
				</p>
			</section>
		{:else}
			<div
				data-testid="screen-investigation"
				class="grid flex-1 grid-cols-1 divide-y divide-zinc-800 lg:grid-cols-12 lg:divide-x lg:divide-y-0"
			>
				<aside class="bg-zinc-950/60 p-4 lg:col-span-3">
					<h2 class="text-xs font-semibold tracking-wider text-zinc-400 uppercase">Order Queue</h2>
					<p class="mt-2 text-xs text-zinc-500">Active order queue ready for stream binding.</p>
				</aside>

				<section class="p-6 lg:col-span-5">
					<h2 class="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
						Operational Canvas
					</h2>
					<p class="mt-2 text-sm text-zinc-400">
						Select an order from the queue to inspect live SLA telemetry and customer timeline.
					</p>
				</section>

				<aside class="bg-zinc-950/60 p-4 lg:col-span-4">
					<h2 class="text-xs font-semibold tracking-wider text-zinc-400 uppercase">AI Sidecar</h2>
					<p class="mt-2 text-xs text-zinc-500">
						Transparent agent thought stream and HITL credit approvals appear here.
					</p>
				</aside>
			</div>
		{/if}
	</main>
</div>
