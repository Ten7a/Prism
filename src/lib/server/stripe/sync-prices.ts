// Sync the local PACKS catalogue into Stripe products + prices, then write the
// resolved stripe_price_id back into token_pack. Idempotent: list-then-create.
//
// Run manually after editing PACKS or before the first checkout in a fresh
// Stripe account:
//   npx tsx -e "import('./src/lib/server/stripe/sync-prices').then(m => m.syncPrices())"

import type Stripe from 'stripe';
import { db } from '$lib/server/db';
import { tokenPack } from '$lib/server/db/schema';
import { PACKS, type Pack } from '$lib/server/tokens/packs';
import { stripe } from './client';

async function findProductBySlug(client: Stripe, slug: string): Promise<Stripe.Product | null> {
	for await (const product of client.products.list({ active: true, limit: 100 })) {
		if (product.metadata?.slug === slug) return product;
	}
	return null;
}

async function findPrice(
	client: Stripe,
	productId: string,
	unitAmount: number,
	currency: string
): Promise<Stripe.Price | null> {
	for await (const price of client.prices.list({ product: productId, active: true, limit: 100 })) {
		if (price.unit_amount === unitAmount && price.currency === currency) return price;
	}
	return null;
}

async function ensurePack(client: Stripe, pack: Pack): Promise<string> {
	let product = await findProductBySlug(client, pack.slug);
	if (!product) {
		product = await client.products.create({
			name: pack.name,
			metadata: { slug: pack.slug }
		});
	}
	let price = await findPrice(client, product.id, pack.priceCents, 'usd');
	if (!price) {
		price = await client.prices.create({
			product: product.id,
			unit_amount: pack.priceCents,
			currency: 'usd',
			metadata: { slug: pack.slug }
		});
	}
	return price.id;
}

export async function syncPrices(): Promise<void> {
	const client = stripe();
	for (const pack of PACKS) {
		const stripePriceId = await ensurePack(client, pack);
		await db
			.insert(tokenPack)
			.values({
				slug: pack.slug,
				name: pack.name,
				tokens: pack.tokens,
				priceCents: pack.priceCents,
				stripePriceId,
				active: true
			})
			.onConflictDoUpdate({
				target: tokenPack.slug,
				set: {
					name: pack.name,
					tokens: pack.tokens,
					priceCents: pack.priceCents,
					stripePriceId,
					active: true
				}
			});
	}
}
