<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Privacy Policy · Prism</title>
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
	.legal-doc :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 0.75rem 0;
	}
	.legal-doc :global(th),
	.legal-doc :global(td) {
		border: 1px solid var(--color-rule, #333);
		padding: 0.4rem 0.6rem;
		text-align: left;
		font-size: 0.9rem;
	}
	.legal-doc :global(ul) {
		padding-left: 1.25rem;
	}
	.legal-doc :global(blockquote) {
		border-left: 2px solid var(--color-rule, #333);
		padding-left: 0.75rem;
		opacity: 0.75;
		font-style: italic;
		margin: 1rem 0;
	}
	.legal-doc :global(code) {
		font-family: var(--font-mono, monospace);
		font-size: 0.9em;
	}
</style>
