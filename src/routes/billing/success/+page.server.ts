import { redirect } from '@sveltejs/kit';
import { getEffectiveBalance } from '$lib/server/tokens/balance';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(303, '/login');
	const balance = await getEffectiveBalance(locals.user.id);
	return {
		balance,
		sessionId: url.searchParams.get('session_id')
	};
};
