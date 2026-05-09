import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listImages } from '$lib/server/library/queries';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) throw error(401, 'unauthorized');

	const cursor = url.searchParams.get('cursor') || undefined;
	const limitRaw = url.searchParams.get('limit');
	let limit = 24;
	if (limitRaw !== null) {
		const n = Number(limitRaw);
		if (!Number.isInteger(n) || n < 1 || n > 60) throw error(400, 'invalid limit');
		limit = n;
	}

	const result = await listImages(locals.user.id, { cursor, limit });
	return json(result);
};
