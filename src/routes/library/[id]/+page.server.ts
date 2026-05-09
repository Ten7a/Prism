import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getImage } from '$lib/server/library/queries';
import { storage } from '$lib/server/storage';

export const load: PageServerLoad = async ({ params, locals, platform }) => {
	if (!locals.user) throw redirect(302, `/login?next=/library/${params.id}`);
	const item = await getImage(locals.user.id, params.id);
	const signedUrl = await storage(platform).signedUrl(item.r2Key, 3600);
	return { image: item, signedUrl };
};
