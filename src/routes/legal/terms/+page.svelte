<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Terms of Service · Prism</title>
</svelte:head>

<article class="legal-doc">
	<header class="meta">
		<span>Version {data.version}</span>
		<span>Effective {data.effective}</span>
	</header>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html data.html}
</article>

<style>
	.legal-doc {
		max-width: 72ch;
		margin: 0 auto;
		padding: 2rem var(--spacing-pad, 1rem);
		color: var(--color-fg);
		line-height: 1.6;
	}
	.meta {
		display: flex;
		gap: 1rem;
		font-size: 0.85rem;
		opacity: 0.7;
		margin-bottom: 2rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.legal-doc :global(h1) {
		font-size: 1.6rem;
		margin-bottom: 1rem;
	}
	.legal-doc :global(h2) {
		font-size: 1.15rem;
		margin: 1.75rem 0 0.5rem;
	}
	.legal-doc :global(ul) {
		padding-left: 1.25rem;
	}
</style>
