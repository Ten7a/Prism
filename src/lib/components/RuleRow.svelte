<script lang="ts">
	type Props = {
		label: string;
		sublabel?: string;
		price: string;
		href: string;
		cta: string;
	};

	let { label, sublabel = '', price, href, cta }: Props = $props();
</script>

<a class="row" {href}>
	<span class="label">
		<span class="primary">{label}</span>
		{#if sublabel}
			<span class="sub">{sublabel}</span>
		{/if}
	</span>
	<span class="price">{price}</span>
	<span class="cta">{cta} →</span>
</a>

<style>
	.row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: baseline;
		gap: 24px;
		padding: 18px 0;
		border-top: 1px solid var(--color-rule);
		font-family: var(--font-mono);
		text-decoration: none;
		color: var(--color-fg);
		transition: background 0.15s;
	}
	.row:last-child {
		border-bottom: 1px solid var(--color-rule);
	}
	.row:hover {
		background: rgba(255, 255, 255, 0.03);
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
	}
</style>
