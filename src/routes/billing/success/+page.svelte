<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let balance = $state(data.balance);
	let polling = $state(false);

	const previous = (() => {
		if (typeof localStorage === 'undefined') return null;
		const raw = localStorage.getItem('prism:previousBalance');
		return raw === null ? null : Number(raw);
	})();

	onMount(async () => {
		if (previous !== null && balance > previous) return;
		polling = true;
		const start = Date.now();
		while (Date.now() - start < 6000) {
			await new Promise((r) => setTimeout(r, 800));
			try {
				const res = await fetch('/api/balance');
				if (res.ok) {
					const j = (await res.json()) as { balance: number };
					balance = j.balance;
					if (previous === null || balance > previous) break;
				}
			} catch {
				// ignore
			}
		}
		polling = false;
		try {
			localStorage.setItem('prism:previousBalance', String(balance));
		} catch {
			// ignore
		}
	});

	const delta = previous === null ? null : balance - previous;
</script>

<svelte:head><title>Purchase complete · Prism</title></svelte:head>

<section class="success">
	<header>
		<span class="tag">/ billing / success</span>
	</header>
	<h1>✓ Purchase complete</h1>
	{#if delta !== null && delta > 0}
		<p class="lede">Credited <strong>{delta}</strong> tokens.</p>
	{:else if polling}
		<p class="lede muted">Waiting for the credit to land…</p>
	{/if}
	<p class="lede">
		Balance: <strong data-testid="balance">{balance}</strong> tokens.
	</p>
	<p>
		<a class="cta" href="/generate">Start generating →</a>
	</p>
</section>

<style>
	.success {
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
	.muted {
		color: var(--color-fg-50);
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
