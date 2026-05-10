import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { storage, uploadKey } from '$lib/server/storage';
import { sniffMatches } from '$lib/server/storage/sniff';
import { getLimiter, parseRateSpec } from '$lib/server/ratelimit';

const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) throw error(401, 'unauthorized');

	const limiter = getLimiter(platform);
	const spec = parseRateSpec(env.RATE_LIMIT_UPLOADS, { capacity: 30, refillPerSec: 30 / 3600 });
	const limited = await limiter.hit(`upload:${locals.user.id}`, spec);
	if (!limited.allowed) {
		return new Response('upload rate limit exceeded', {
			status: 429,
			headers: { 'Retry-After': String(limited.retryAfterSec ?? 1) }
		});
	}

	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) throw error(400, 'missing file field');

	const mime = file.type;
	if (!ALLOWED_MIMES.has(mime)) throw error(415, 'unsupported media type');
	if (file.size > MAX_BYTES) throw error(413, 'file too large');

	const buf = new Uint8Array(await file.arrayBuffer());
	if (!sniffMatches(buf.subarray(0, 16), mime)) {
		throw error(415, 'file content does not match declared mime');
	}

	const key = uploadKey(locals.user.id, mime);
	const store = storage(platform);
	await store.put(key, buf, { contentType: mime });
	const url = await store.signedUrl(key, 300);

	return json({ key, url });
};
