<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { hydrateConsentFromDocument } from '$lib/stores/consent';
	import CookieBanner from '$lib/components/CookieBanner.svelte';

	let { children } = $props();

	onMount(() => {
		hydrateConsentFromDocument();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
	<header class="shell-header">
		<a href="/" class="wordmark">PRISM</a>
		<nav class="nav">
			<a href="/generate">Generate</a>
			<a href="/library">Library</a>
			<a href="/account">Account</a>
		</nav>
	</header>

	<main class="has-rules-rails">
		{@render children()}
	</main>

	<footer class="shell-footer">
		<div class="legal">
			<a href="/legal/privacy">Privacy</a>
			<a href="/legal/terms">Terms</a>
			<a href="/account/privacy">Your data</a>
		</div>
		<div class="copy">© Prism</div>
	</footer>
</div>

<CookieBanner />

<div class="scanlines"></div>
<div class="vignette"></div>

<style>
	.shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.shell-header {
		position: sticky;
		top: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px var(--spacing-pad);
		border-bottom: 1px solid var(--color-rule);
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		font-family: var(--font-mono);
	}

	.wordmark {
		font-size: 13px;
		letter-spacing: 0.2em;
		color: var(--color-fg);
		text-decoration: none;
	}

	.nav {
		display: flex;
		gap: 22px;
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.nav a {
		color: var(--color-fg-70);
		text-decoration: none;
		transition: color 0.2s;
	}

	.nav a:hover {
		color: var(--color-fg);
	}

	main {
		flex: 1;
	}

	.shell-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px var(--spacing-pad);
		border-top: 1px solid var(--color-rule);
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.1em;
		color: var(--color-fg-50);
		text-transform: uppercase;
	}

	.legal {
		display: flex;
		gap: 18px;
	}

	.legal a {
		color: var(--color-fg-50);
		text-decoration: none;
	}

	.legal a:hover {
		color: var(--color-fg);
	}
</style>
