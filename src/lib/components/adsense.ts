declare global {
	interface Window {
		adsbygoogle?: unknown[];
		__adsenseLoaded?: boolean;
	}
}

export function isDoNotTrack(): boolean {
	if (typeof navigator === 'undefined') return false;
	const dnt = (navigator as Navigator & { doNotTrack?: string | null }).doNotTrack;
	if (dnt == null) return false;
	const v = String(dnt).toLowerCase();
	return v !== '0' && v !== 'unspecified' && v !== 'null';
}

export function loadAdSenseOnce(clientId: string): void {
	if (typeof window === 'undefined' || typeof document === 'undefined') return;
	if (window.__adsenseLoaded) return;
	if (!clientId) return;
	const src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
	const existing = document.querySelector(`script[src="${src}"]`);
	if (existing) {
		window.__adsenseLoaded = true;
		return;
	}
	const s = document.createElement('script');
	s.async = true;
	s.crossOrigin = 'anonymous';
	s.src = src;
	document.head.appendChild(s);
	window.__adsenseLoaded = true;
}

export function pushAd(): void {
	if (typeof window === 'undefined') return;
	(window.adsbygoogle = window.adsbygoogle || []).push({});
}
