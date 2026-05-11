import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { image } from '$lib/server/db/schema';
import { storage } from '$lib/server/storage';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) throw error(404, 'not found');
	if (!UUID_RE.test(params.id)) throw error(404, 'not found');

	const row = await db.query.image.findFirst({ where: eq(image.id, params.id) });
	// Treat unauthorized as 404 to avoid id enumeration.
	if (!row || row.userId !== locals.user.id) throw error(404, 'not found');

	const url = await storage(platform).signedUrl(row.r2Key, 300);
	throw redirect(302, url);
};
