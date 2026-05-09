import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadModels } from '$lib/server/openrouter/registry';
import { getBalance } from '$lib/server/db/queries/balance';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.user) throw redirect(302, '/login?next=/generate');

	const [models, balance] = await Promise.all([
		loadModels(platform),
		getBalance(locals.user.id)
	]);

	return { models, balance };
};
