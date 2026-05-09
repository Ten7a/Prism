import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CONSENT_DEFAULT, CONSENT_VERSION } from '$lib/stores/consent';
import { getCurrentConsent, upsertConsent } from '$lib/server/consent/store';

const ANON_COOKIE = 'prism_anon';
const THIRTEEN_MONTHS = 60 * 60 * 24 * 30 * 13;

function ensureAnonId(cookies: import('@sveltejs/kit').Cookies): string {
	const existing = cookies.get(ANON_COOKIE);
	if (existing) return existing;
	const anonId =
		'anon_' +
		(globalThis.crypto?.randomUUID?.() ??
			Math.random().toString(36).slice(2) + Date.now().toString(36));
	cookies.set(ANON_COOKIE, anonId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: THIRTEEN_MONTHS
	});
	return anonId;
}

export const GET: RequestHandler = async ({ locals, cookies }) => {
	const userId = locals.user?.id ?? null;
	const anonId = userId ? null : (cookies.get(ANON_COOKIE) ?? null);
	const row = await getCurrentConsent({ userId, anonId });
	if (!row) {
		return json({ ...CONSENT_DEFAULT, version: CONSENT_VERSION });
	}
	return json({
		necessary: row.necessary,
		analytics: row.analytics,
		ads: row.ads,
		version: row.version,
		acceptedAt: row.acceptedAt
	});
};

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'invalid json');
	}
	if (!body || typeof body !== 'object') throw error(400, 'invalid payload');
	const b = body as Record<string, unknown>;
	const necessary = b.necessary !== false;
	const analytics = b.analytics === true;
	const ads = b.ads === true;
	if (!necessary) throw error(400, 'necessary cookies required');

	const userId = locals.user?.id ?? null;
	const anonId = userId ? null : ensureAnonId(cookies);

	await upsertConsent({
		userId,
		anonId,
		version: CONSENT_VERSION,
		necessary,
		analytics,
		ads
	});

	return new Response(null, { status: 204 });
};
