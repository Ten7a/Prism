import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { CONSENT_VERSION } from '$lib/stores/consent';
import { getCurrentConsent, listConsents, upsertConsent } from '$lib/server/consent/store';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	const userId = locals.user.id;
	const [current, history] = await Promise.all([
		getCurrentConsent({ userId }),
		listConsents({ userId })
	]);
	return {
		current: current
			? {
					necessary: current.necessary,
					analytics: current.analytics,
					ads: current.ads,
					version: current.version,
					acceptedAt: current.acceptedAt.toISOString()
				}
			: null,
		history: history.map((row) => ({
			id: row.id,
			version: row.version,
			necessary: row.necessary,
			analytics: row.analytics,
			ads: row.ads,
			acceptedAt: row.acceptedAt.toISOString()
		})),
		policyVersion: CONSENT_VERSION
	};
};

export const actions: Actions = {
	update: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		const data = await request.formData();
		const analytics = data.get('analytics') === 'on';
		const ads = data.get('ads') === 'on';
		try {
			await upsertConsent({
				userId: locals.user.id,
				version: CONSENT_VERSION,
				necessary: true,
				analytics,
				ads
			});
		} catch {
			return fail(500, { error: 'Could not save preferences.' });
		}
		return { saved: true };
	}
};
