import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEffectiveBalance, nextUtcMidnightISO } from '$lib/server/tokens/balance';
import { dailyAllowanceTokens } from '$lib/server/tokens/grant';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'unauthorized');
	const balance = await getEffectiveBalance(locals.user.id);
	return json({
		balance,
		dailyAllowance: dailyAllowanceTokens(),
		nextResetAt: nextUtcMidnightISO()
	});
};
