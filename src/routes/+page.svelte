<script lang="ts">
	import { LogOut, ShieldCheck } from 'lucide-svelte';
	import LoginCard from '$lib/components/LoginCard.svelte';
	import { session } from '$lib/stores/session.svelte';
</script>

{#if !session.authenticated}
	<LoginCard />
{:else}
	<div
		data-testid="resolution-studio-shell"
		class="flex min-h-screen flex-col bg-[#09090b] text-zinc-100"
	>
		<header
			class="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4"
		>
			<div class="flex items-center gap-3">
				<span class="text-sm font-semibold tracking-tight text-zinc-50">FerrousCX</span>
				<span class="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
					Resolution Studio
				</span>
			</div>

			<div class="flex items-center gap-3 text-xs">
				<div class="flex items-center gap-1.5 text-zinc-300">
					<ShieldCheck class="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
					<span data-testid="operator-username">{session.username}</span>
					{#if session.role}
						<span class="rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-400">
							{session.role}
						</span>
					{/if}
					{#if session.tenant}
						<span class="rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-500">
							{session.tenant}
						</span>
					{/if}
				</div>
				<button
					type="button"
					onclick={() => session.logout()}
					class="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
				>
					<LogOut class="h-3.5 w-3.5" aria-hidden="true" />
					<span>Sign Out</span>
				</button>
			</div>
		</header>

		<div class="grid flex-1 grid-cols-1 divide-y divide-zinc-800 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
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
	</div>
{/if}
