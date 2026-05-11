<script lang="ts">
	import AdSlot from '$lib/components/AdSlot.svelte';
</script>

<section class="hero sec">
	<span class="tag">v0.1 — preview</span>
	<h1>Generate images, mono and direct.</h1>
	<p class="lede">A focused image studio. No clutter, no ceremony — just prompt, generate, keep.</p>
	<div class="cta-row">
		<a class="chip" href="/generate">Start generating</a>
		<a class="chip" href="/library">Open library</a>
	</div>
</section>

<section class="how sec">
	<header class="sec-head">
		<span class="tag">How it works</span>
		<h2>Three steps. No detours.</h2>
	</header>
	<ol class="steps">
		<li>
			<span class="step-no">01</span>
			<h3>Describe</h3>
			<p>Write the prompt. Pick a model. That's the whole input.</p>
		</li>
		<li>
			<span class="step-no">02</span>
			<h3>Generate</h3>
			<p>Stream results in monochrome. Iterate without losing the thread.</p>
		</li>
		<li>
			<span class="step-no">03</span>
			<h3>Keep</h3>
			<p>Saved to your library. Searchable, taggable, exportable.</p>
		</li>
	</ol>
</section>

<section class="ad-footer sec">
	<AdSlot slot="landing-footer" />
</section>

<style>
	.hero h1 {
		font-family: var(--font-mono);
		font-weight: 500;
		font-size: clamp(36px, 6vw, 72px);
		line-height: 1.05;
		letter-spacing: -0.02em;
		margin: 18px 0 14px;
		max-width: 18ch;
	}

	.lede {
		font-family: var(--font-mono);
		color: var(--color-fg-70);
		font-size: clamp(14px, 1.4vw, 16px);
		max-width: 56ch;
		line-height: 1.55;
	}

	.cta-row {
		display: flex;
		gap: 12px;
		margin-top: 28px;
	}

	.cta-row .chip {
		text-decoration: none;
		padding: 10px 16px;
		font-size: 11px;
	}

	.how h2 {
		font-family: var(--font-mono);
		font-weight: 500;
		font-size: clamp(22px, 3vw, 32px);
		letter-spacing: -0.01em;
	}

	.steps {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: var(--color-rule);
		border: 1px solid var(--color-rule);
	}

	.steps li {
		padding: 28px;
		background: #000;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.step-no {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.2em;
		color: var(--color-fg-30);
	}

	.steps h3 {
		font-family: var(--font-mono);
		font-weight: 500;
		font-size: 16px;
		letter-spacing: -0.01em;
	}

	.steps p {
		font-family: var(--font-mono);
		color: var(--color-fg-70);
		font-size: 13px;
		line-height: 1.5;
	}

	@media (max-width: 720px) {
		.steps {
			grid-template-columns: 1fr;
		}
	}
</style>
