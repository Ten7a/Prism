import { writable } from 'svelte/store';

export type ConsentState = {
	necessary: boolean;
	analytics: boolean;
	ads: boolean;
};

export const CONSENT_DEFAULT: ConsentState = {
	necessary: true,
	analytics: false,
	ads: false
};

export const CONSENT_COOKIE = 'prism_consent';
export const CONSENT_VERSION = 'v1';

export const consentStore = writable<ConsentState>(CONSENT_DEFAULT);

export function parseConsentCookie(value: string | undefined | null): ConsentState {
	if (!value) return { ...CONSENT_DEFAULT };
	const trimmed = value.trim();
	if (!trimmed.startsWith(CONSENT_VERSION + ':')) return { ...CONSENT_DEFAULT };
	const payload = trimmed.slice(CONSENT_VERSION.length + 1);
	const parts = payload.split(',');
	const out: ConsentState = { ...CONSENT_DEFAULT };
	for (const part of parts) {
		const [k, v] = part.split('=');
		const on = v === '1';
		if (k === 'a') out.analytics = on;
		else if (k === 'ads') out.ads = on;
		// "n" (necessary) is always true and not parsed back.
	}
	return out;
}

export function serializeConsent(state: ConsentState): string {
	return `${CONSENT_VERSION}:n=1,a=${state.analytics ? 1 : 0},ads=${state.ads ? 1 : 0}`;
}

function readCookieFromDocument(name: string): string | undefined {
	if (typeof document === 'undefined') return undefined;
	const all = document.cookie ? document.cookie.split('; ') : [];
	for (const entry of all) {
		const eq = entry.indexOf('=');
		if (eq < 0) continue;
		if (entry.slice(0, eq) === name) return decodeURIComponent(entry.slice(eq + 1));
	}
	return undefined;
}

export function hydrateConsentFromDocument(): void {
	if (typeof document === 'undefined') return;
	consentStore.set(parseConsentCookie(readCookieFromDocument(CONSENT_COOKIE)));
}

export function setConsent(state: ConsentState): void {
	consentStore.set(state);
	if (typeof document === 'undefined') return;
	const oneYear = 60 * 60 * 24 * 365;
	document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(serializeConsent(state))}; path=/; max-age=${oneYear}; SameSite=Lax`;
}
