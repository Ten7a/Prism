<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		left: Snippet;
		center?: Snippet;
		right?: Snippet;
		href?: string;
		as?: 'a' | 'div' | 'form';
		method?: 'GET' | 'POST' | 'get' | 'post';
		action?: string;
		onsubmit?: (e: SubmitEvent) => void;
	};

	let { left, center, right, href, as, method, action, onsubmit }: Props = $props();

	const tag = $derived(as ?? (href ? 'a' : 'div'));
</script>

{#if tag === 'a'}
	<a class="row row-hover-shift row-base" {href}>
		<span class="left">{@render left()}</span>
		{#if center}<span class="center">{@render center()}</span>{/if}
		{#if right}<span class="right">{@render right()}</span>{/if}
	</a>
{:else if tag === 'form'}
	<form class="row row-hover-shift row-base" {method} {action} {onsubmit}>
		<span class="left">{@render left()}</span>
		{#if center}<span class="center">{@render center()}</span>{/if}
		{#if right}<span class="right">{@render right()}</span>{/if}
	</form>
{:else}
	<div class="row row-hover-shift row-base">
		<span class="left">{@render left()}</span>
		{#if center}<span class="center">{@render center()}</span>{/if}
		{#if right}<span class="right">{@render right()}</span>{/if}
	</div>
{/if}

<style>
	.row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: baseline;
		gap: 24px;
		padding: 18px 0;
		font-family: var(--font-mono);
		text-decoration: none;
		color: var(--color-fg);
		margin: 0;
	}
	.center {
		text-align: right;
	}
	.right {
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-fg-70);
	}
</style>
