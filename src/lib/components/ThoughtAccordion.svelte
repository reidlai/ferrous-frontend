<script lang="ts">
	import { untrack } from 'svelte';
	import type { CopilotThought, ToolCallBadge } from '$lib/api/orders';

	interface ThoughtAccordionProps {
		thoughts: CopilotThought[];
		toolCalls: ToolCallBadge[];
		defaultExpanded?: boolean;
	}

	let { thoughts, toolCalls, defaultExpanded = true }: ThoughtAccordionProps = $props();

	let expanded = $state(untrack(() => defaultExpanded));

	const totalThoughtMs = $derived(
		thoughts.reduce((sum, item) => sum + (Number.isFinite(item.durationMs) ? item.durationMs : 0), 0)
	);
</script>

<section
	data-testid="thought-accordion"
	aria-label="Copilot thought process"
	class="rounded-lg border border-zinc-800 bg-zinc-900/70"
>
	<button
		type="button"
		data-testid="thought-accordion-toggle"
		aria-expanded={expanded}
		aria-controls="thought-accordion-body"
		onclick={() => (expanded = !expanded)}
		class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-zinc-800/50"
	>
		<div class="flex items-center gap-2">
			<span class="font-mono text-[11px] font-semibold tracking-wider text-purple-300 uppercase">
				Thought Process
			</span>
			<span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
				{thoughts.length} {thoughts.length === 1 ? 'step' : 'steps'}
			</span>
		</div>

		<div class="flex items-center gap-2">
			<span
				data-testid="thought-total-latency"
				class="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] text-purple-300"
			>
				{totalThoughtMs}ms
			</span>
			<svg
				class="h-3.5 w-3.5 text-zinc-400 transition-transform {expanded ? 'rotate-180' : ''}"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
					clip-rule="evenodd"
				/>
			</svg>
		</div>
	</button>

	{#if expanded}
		<div
			id="thought-accordion-body"
			data-testid="thought-accordion-body"
			class="border-t border-zinc-800 px-3 py-2.5"
		>
			{#if thoughts.length === 0}
				<p class="text-xs text-zinc-500">No copilot reasoning steps recorded.</p>
			{:else}
				<ol class="space-y-2">
					{#each thoughts as thought, index (thought.id)}
						<li class="rounded border border-zinc-800/80 bg-zinc-950/70 p-2">
							<div class="flex items-start justify-between gap-2">
								<p class="text-xs font-medium text-zinc-200">
									<span class="mr-1.5 font-mono text-[10px] text-zinc-500">
										{String(index + 1).padStart(2, '0')}
									</span>
									{thought.step}
								</p>
								<span
									class="shrink-0 rounded-full border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
								>
									{thought.durationMs}ms
								</span>
							</div>
							<p class="mt-1 text-[11px] leading-relaxed text-zinc-400">{thought.detail}</p>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	{/if}

	{#if toolCalls.length > 0}
		<div
			data-testid="tool-call-badges"
			class="flex flex-wrap items-center gap-1.5 border-t border-zinc-800/80 px-3 py-2"
		>
			{#each toolCalls as tc (tc.id)}
				<span
					data-testid="tool-call-badge"
					class="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-[10px] text-zinc-300"
				>
					<span
						class="h-1.5 w-1.5 rounded-full {tc.status === 'ok'
							? 'bg-emerald-400'
							: tc.status === 'warn'
								? 'bg-amber-400'
								: 'bg-red-400'}"
					></span>
					<span class="sr-only">{tc.status}</span>
					<span>{tc.tool}</span>
					<span class="text-zinc-500">{tc.latencyMs}ms</span>
				</span>
			{/each}
		</div>
	{/if}
</section>
