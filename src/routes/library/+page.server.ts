import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listImages } from '$lib/server/library/queries';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login?next=/library');
	const initial = await listImages(locals.user.id, { limit: 24 });
	return { initial };
};
