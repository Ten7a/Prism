<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		caption?: string;
		right?: Snippet;
	};

	let { title, caption, right }: Props = $props();
</script>

<header class="sec-head">
	<div class="row">
		<h2 class="sec-title">{title}</h2>
		{#if right}
			<div class="actions">{@render right()}</div>
		{/if}
	</div>
	{#if caption}
		<p class="sec-caption">{caption}</p>
	{/if}
</header>

<style>
	.row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	.sec-title {
		font-family: var(--font-mono);
		font-weight: 500;
		font-size: 14px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		margin: 0;
		color: var(--color-fg);
	}
	.sec-caption {
		font-size: 12px;
		color: var(--color-fg-70);
		margin: 6px 0 0;
		max-width: 60ch;
	}
	.actions {
		display: flex;
		gap: 8px;
	}
</style>
