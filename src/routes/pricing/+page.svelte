<script lang="ts">
	import type { PageData } from './$types';
	import { RuleRow, Tag } from '$lib/ui';

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
		<Tag>/ pricing</Tag>
		<span class="meta">tokens · packs</span>
	</header>

	<p class="lede">
		Tokens debit per generation. 1 token ≈ $0.01 of model spend. Top up any time —
		unused tokens never expire.
	</p>

	<div class="rows">
		{#each data.packs as p (p.slug)}
			{#snippet packLeft()}
				<input type="hidden" name="pack" value={p.slug} />
				<span class="label">
					<span class="primary">Buy {p.tokens}</span>
					{#if p.note}
						<span class="sub">{p.note}</span>
					{/if}
				</span>
			{/snippet}
			{#snippet packCenter()}<span class="price">{usd(p.priceCents)}</span>{/snippet}
			{#snippet packRight()}
				<button type="submit" class="cta">checkout →</button>
			{/snippet}
			<RuleRow
				as="form"
				method="POST"
				action="/api/billing/checkout"
				left={packLeft}
				center={packCenter}
				right={packRight}
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
	.label {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.primary {
		font-size: 14px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.sub {
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--color-fg-50);
	}
	.price {
		font-size: 14px;
		color: var(--color-fg);
		min-width: 80px;
		text-align: right;
	}
	.cta {
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-fg-70);
		background: transparent;
		border: none;
		cursor: pointer;
		font-family: inherit;
		padding: 0;
	}
	.cta:hover {
		color: var(--color-fg);
	}
	.note {
		margin-top: 28px;
		font-size: 11px;
		letter-spacing: 0.06em;
		color: var(--color-fg-50);
	}
</style>
