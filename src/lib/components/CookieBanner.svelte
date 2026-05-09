<script lang="ts">
	import { onMount } from 'svelte';
	import {
		CONSENT_COOKIE,
		CONSENT_VERSION,
		consentStore,
		serializeConsent,
		setConsent,
		type ConsentState
	} from '$lib/stores/consent';

	let visible = $state(false);
	let customizing = $state(false);
	let analytics = $state(false);
	let ads = $state(false);
	let saving = $state(false);

	function readVersion(): string | null {
		if (typeof document === 'undefined') return null;
		const cookie = document.cookie.split('; ').find((c) => c.startsWith(CONSENT_COOKIE + '='));
		if (!cookie) return null;
		const value = decodeURIComponent(cookie.split('=')[1] ?? '');
		const colon = value.indexOf(':');
		return colon > 0 ? value.slice(0, colon) : null;
	}

	onMount(() => {
		const version = readVersion();
		visible = version !== CONSENT_VERSION;
	});

	async function persist(state: ConsentState) {
		setConsent(state);
		try {
			await fetch('/api/consent', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(state)
			});
		} catch {
			// network failures shouldn't block UX; cookie is the source of truth client-side
		}
	}

	async function acceptAll() {
		saving = true;
		await persist({ necessary: true, analytics: true, ads: true });
		saving = false;
		visible = false;
	}

	async function savePreferences() {
		saving = true;
		await persist({ necessary: true, analytics, ads });
		saving = false;
		visible = false;
	}

	function dismiss() {
		// Closing without choosing → necessary-only.
		void persist({ necessary: true, analytics: false, ads: false });
		visible = false;
	}

	// Re-sync local toggle state when the store changes (e.g. /account/privacy)
	consentStore.subscribe((s) => {
		analytics = s.analytics;
		ads = s.ads;
	});

	// expose a small marker for testing
	const _serialized = $derived(serializeConsent({ necessary: true, analytics, ads }));
</script>

{#if visible}
	<div class="banner glass" role="dialog" aria-label="Cookie preferences" data-testid="cookie-banner">
		<div class="copy">
			<strong>We use cookies.</strong>
			<span>
				Necessary cookies keep Prism working. With your consent we also use analytics and
				advertising cookies — see our
				<a href="/legal/privacy">Privacy Policy</a>.
			</span>
		</div>

		{#if customizing}
			<div class="toggles">
				<label class="toggle">
					<input type="checkbox" checked disabled />
					<span>Necessary <em>(always on)</em></span>
				</label>
				<label class="toggle">
					<input type="checkbox" bind:checked={analytics} />
					<span>Analytics</span>
				</label>
				<label class="toggle">
					<input type="checkbox" bind:checked={ads} />
					<span>Ads</span>
				</label>
			</div>
		{/if}

		<div class="actions">
			{#if !customizing}
				<button type="button" class="ghost" onclick={() => (customizing = true)}>
					Customize
				</button>
				<button type="button" class="primary" onclick={acceptAll} disabled={saving}>
					Accept all
				</button>
			{:else}
				<button type="button" class="ghost" onclick={dismiss} disabled={saving}>
					Necessary only
				</button>
				<button type="button" class="primary" onclick={savePreferences} disabled={saving}>
					Save preferences
				</button>
			{/if}
		</div>
		<!-- hidden marker for tests -->
		<span hidden data-testid="serialized-consent">{_serialized}</span>
	</div>
{/if}

<style>
	.banner {
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 60;
		max-width: min(420px, calc(100vw - 32px));
		padding: 16px;
		border-radius: 4px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.04em;
		color: var(--color-fg);
	}
	.copy {
		line-height: 1.5;
	}
	.copy strong {
		display: block;
		font-size: 12px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		margin-bottom: 4px;
	}
	.copy a {
		color: var(--color-fg);
		text-decoration: underline;
	}
	.toggles {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		border: 1px solid var(--color-rule);
		border-radius: 3px;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}
	.toggle em {
		opacity: 0.5;
		font-style: normal;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	button {
		font: inherit;
		padding: 6px 12px;
		border-radius: 3px;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		cursor: pointer;
		transition: background 0.15s;
	}
	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.ghost {
		background: transparent;
		border: 1px solid var(--color-rule);
		color: var(--color-fg-70);
	}
	.ghost:hover:not(:disabled) {
		color: var(--color-fg);
	}
	.primary {
		background: var(--color-fg);
		border: 1px solid var(--color-fg);
		color: #000;
	}
	.primary:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.85);
	}
</style>
