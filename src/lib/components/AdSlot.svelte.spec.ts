import { render } from 'vitest-browser-svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AdSlot from './AdSlot.svelte';
import { consentStore, CONSENT_DEFAULT } from '$lib/stores/consent';

const PAGEAD_SELECTOR = 'script[src*="pagead2"]';

function clearAdSenseDom() {
	for (const el of Array.from(document.querySelectorAll(PAGEAD_SELECTOR))) {
		el.remove();
	}
	(window as unknown as { __adsenseLoaded?: boolean }).__adsenseLoaded = false;
}

function stubDoNotTrack(value: string | null) {
	Object.defineProperty(navigator, 'doNotTrack', {
		value,
		configurable: true,
		writable: true
	});
}

describe('AdSlot', () => {
	beforeEach(() => {
		clearAdSenseDom();
		stubDoNotTrack('0');
		consentStore.set({ ...CONSENT_DEFAULT });
	});

	afterEach(() => {
		clearAdSenseDom();
		consentStore.set({ ...CONSENT_DEFAULT });
	});

	test('renders nothing without consent', async () => {
		consentStore.set({ necessary: true, analytics: false, ads: false });
		render(AdSlot, { props: { slot: 'library-top' } });
		// allow onMount + effect to settle
		await new Promise((r) => setTimeout(r, 50));
		expect(document.querySelector('ins.adsbygoogle')).toBeNull();
		expect(document.querySelector(PAGEAD_SELECTOR)).toBeNull();
	});

	test('renders <ins> and injects script when consent is granted', async () => {
		consentStore.set({ necessary: true, analytics: true, ads: true });
		render(AdSlot, { props: { slot: 'library-top' } });
		await vi.waitFor(
			() => {
				expect(document.querySelectorAll(PAGEAD_SELECTOR)).toHaveLength(1);
				expect(document.querySelector('ins.adsbygoogle')).toBeTruthy();
			},
			{ timeout: 2000 }
		);
	});

	test('respects Do-Not-Track even with consent', async () => {
		stubDoNotTrack('1');
		consentStore.set({ necessary: true, analytics: true, ads: true });
		render(AdSlot, { props: { slot: 'library-top' } });
		await new Promise((r) => setTimeout(r, 50));
		expect(document.querySelector('ins.adsbygoogle')).toBeNull();
		expect(document.querySelector(PAGEAD_SELECTOR)).toBeNull();
	});

	test('removes <ins> when consent is revoked', async () => {
		consentStore.set({ necessary: true, analytics: true, ads: true });
		render(AdSlot, { props: { slot: 'library-top' } });
		await vi.waitFor(() => {
			expect(document.querySelector('ins.adsbygoogle')).toBeTruthy();
		});
		consentStore.set({ necessary: true, analytics: false, ads: false });
		await vi.waitFor(() => {
			expect(document.querySelector('ins.adsbygoogle')).toBeNull();
		});
	});
});
