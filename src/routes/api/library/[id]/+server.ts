import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteImage } from '$lib/server/library/queries';

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) throw error(401, 'unauthorized');
	await deleteImage(locals.user.id, params.id, platform);
	return new Response(null, { status: 204 });
};
