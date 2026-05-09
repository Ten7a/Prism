<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		PUBLIC_ADSENSE_CLIENT_ID,
		PUBLIC_ADSENSE_SLOT_LIBRARY_TOP,
		PUBLIC_ADSENSE_SLOT_LANDING_FOOTER
	} from '$env/static/public';
	import { consentStore } from '$lib/stores/consent';
	import { isDoNotTrack, loadAdSenseOnce, pushAd } from './adsense';

	type SlotName = 'library-top' | 'landing-footer';

	let { slot, format = 'auto' }: { slot: SlotName; format?: 'auto' | 'fluid' } = $props();

	let mounted = $state(false);
	let dnt = $state(false);

	onMount(() => {
		mounted = true;
		dnt = isDoNotTrack();
	});

	const clientId = PUBLIC_ADSENSE_CLIENT_ID ?? '';

	function slotIdFor(name: SlotName): string {
		switch (name) {
			case 'library-top':
				return PUBLIC_ADSENSE_SLOT_LIBRARY_TOP ?? '';
			case 'landing-footer':
				return PUBLIC_ADSENSE_SLOT_LANDING_FOOTER ?? '';
		}
	}

	const adsConsent = $derived($consentStore.ads);
	const slotId = $derived(slotIdFor(slot));
	const enabled = $derived(mounted && adsConsent && !dnt && !!clientId && !!slotId);

	$effect(() => {
		if (!enabled) return;
		void (async () => {
			loadAdSenseOnce(clientId);
			await tick();
			try {
				pushAd();
			} catch {
				// adsbygoogle.push can throw if the slot was already filled; safe to ignore.
			}
		})();
	});
</script>

{#if enabled}
	<ins
		class="adsbygoogle"
		style="display:block"
		data-ad-client={clientId}
		data-ad-slot={slotId}
		data-ad-format={format}
		data-full-width-responsive="true"
	></ins>
{/if}

<style>
	ins.adsbygoogle {
		display: block;
		margin: 16px 0;
		min-height: 90px;
	}
</style>
