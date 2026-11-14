<script lang="ts">
	import LoginCard from '$lib/components/LoginCard.svelte';
	import StudioShell from '$lib/components/StudioShell.svelte';
	import { session } from '$lib/stores/session.svelte';
</script>

{#if !session.authenticated}
	<LoginCard />
{:else}
	<StudioShell initialPath="/radar" />
{/if}
