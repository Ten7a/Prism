<svelte:head><title>Checkout cancelled · Prism</title></svelte:head>

<section class="cancel">
	<header>
		<span class="tag">/ billing / cancel</span>
	</header>
	<h1>No charge</h1>
	<p class="lede">Your cart is empty — you weren't billed.</p>
	<p>
		<a class="cta" href="/pricing">← Back to pricing</a>
	</p>
</section>

<style>
	.cancel {
		max-width: 640px;
		margin: 80px auto;
		padding: 0 var(--spacing-pad);
		font-family: var(--font-mono);
	}
	.tag {
		font-size: 11px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-fg-50);
	}
	h1 {
		font-weight: 500;
		font-size: 22px;
		margin: 14px 0 18px;
	}
	.lede {
		font-size: 13px;
		line-height: 1.6;
		color: var(--color-fg-70);
	}
	.cta {
		display: inline-block;
		margin-top: 20px;
		font-size: 12px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-fg);
		border-bottom: 1px solid var(--color-fg);
		padding-bottom: 2px;
		text-decoration: none;
	}
</style>
