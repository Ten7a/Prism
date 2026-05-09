<script lang="ts">
	import RuleRow from '$lib/components/RuleRow.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function usd(cents: number): string {
		return `$${(cents / 100).toFixed(2)}`;
	}
</script>

<svelte:head>
	<title>Pricing · Prism</title>
</svelte:head>

<section class="pricing">
	<header class="page-head">
		<span class="tag">/ pricing</span>
		<span class="meta">tokens · packs</span>
	</header>

	<p class="lede">
		Tokens debit per generation. 1 token ≈ $0.01 of model spend. Top up any time —
		unused tokens never expire.
	</p>

	<div class="rows">
		{#each data.packs as p (p.slug)}
			<RuleRow
				label={`Buy ${p.tokens}`}
				sublabel={p.note}
				price={usd(p.priceCents)}
				href={`/api/billing/checkout?pack=${p.slug}`}
				cta="checkout"
			/>
		{/each}
	</div>

	<p class="note">
		Every authenticated account also receives a small daily allowance of free tokens.
	</p>
</section>

<style>
	.pricing {
		padding: var(--spacing-pad);
		max-width: 760px;
		margin: 0 auto;
		font-family: var(--font-mono);
	}
	.page-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding-bottom: 18px;
		border-bottom: 1px solid var(--color-rule);
		margin-bottom: 28px;
	}
	.tag {
		font-size: 12px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-fg);
	}
	.meta {
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-fg-50);
	}
	.lede {
		font-size: 13px;
		line-height: 1.6;
		color: var(--color-fg-70);
		margin: 0 0 28px;
		max-width: 56ch;
	}
	.rows {
		display: flex;
		flex-direction: column;
	}
	.note {
		margin-top: 28px;
		font-size: 11px;
		letter-spacing: 0.06em;
		color: var(--color-fg-50);
	}
</style>
