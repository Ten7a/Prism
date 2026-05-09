import { db } from './index';
import { tokenPack } from './schema';
import { PACKS } from '../tokens/packs';

export async function seedPacks(): Promise<void> {
	const rows = PACKS.map((p) => ({
		slug: p.slug,
		name: p.name,
		tokens: p.tokens,
		priceCents: p.priceCents,
		stripePriceId: `seed:${p.slug}`,
		active: true
	}));
	await db.insert(tokenPack).values(rows).onConflictDoNothing({ target: tokenPack.slug });
}
