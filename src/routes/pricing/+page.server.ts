import type { PageServerLoad } from './$types';
import { PACKS } from '$lib/server/tokens/packs';

export const load: PageServerLoad = async () => {
	return {
		packs: PACKS.map((p) => ({
			slug: p.slug,
			name: p.name,
			tokens: p.tokens,
			priceCents: p.priceCents,
			note: p.note
		}))
	};
};
