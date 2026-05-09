import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { storage, uploadKey } from '$lib/server/storage';
import { sniffMatches } from '$lib/server/storage/sniff';
import { checkUploadRate } from '$lib/server/storage/rate-limit';

const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) throw error(401, 'unauthorized');

	if (!checkUploadRate(locals.user.id)) {
		throw error(429, 'upload rate limit exceeded');
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
