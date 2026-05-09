import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadModels } from '$lib/server/openrouter/registry';
import { getEffectiveBalance } from '$lib/server/tokens/balance';
import { getImage } from '$lib/server/library/queries';
import { storage } from '$lib/server/storage';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.user) throw redirect(302, '/login?next=/generate');

	const [models, balance] = await Promise.all([
		loadModels(platform),
		getEffectiveBalance(locals.user.id)
	]);

	const refId = url.searchParams.get('ref');
	let preloadRef: { key: string; url: string } | null = null;
	if (refId && UUID_RE.test(refId)) {
		try {
			const item = await getImage(locals.user.id, refId);
			const signed = await storage(platform).signedUrl(item.r2Key, 300);
			preloadRef = { key: item.r2Key, url: signed };
		} catch {
			preloadRef = null;
		}
	}

	return { models, balance, preloadRef };
};
