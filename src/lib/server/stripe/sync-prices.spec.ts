import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

vi.mock('$env/dynamic/private', async () => {
	const actual =
		await vi.importActual<typeof import('$env/dynamic/private')>('$env/dynamic/private');
	return { env: { ...actual.env, STRIPE_SECRET_KEY: 'sk_test_sync' } };
});

type Product = { id: string; metadata: Record<string, string>; active: boolean };
type Price = {
	id: string;
	product: string;
	unit_amount: number;
	currency: string;
	active: boolean;
	metadata: Record<string, string>;
};

let products: Product[] = [];
let prices: Price[] = [];
const counts = { productsPost: 0, pricesPost: 0 };

function parseForm(body: string): Record<string, string> {
	const params = new URLSearchParams(body);
	const out: Record<string, string> = {};
	for (const [k, v] of params) out[k] = v;
	return out;
}

const server = setupServer(
	http.get('https://api.stripe.com/v1/products', () => {
		return HttpResponse.json({ object: 'list', data: products, has_more: false });
	}),
	http.post('https://api.stripe.com/v1/products', async ({ request }) => {
		counts.productsPost += 1;
		const form = parseForm(await request.text());
		const id = `prod_${products.length + 1}`;
		const product: Product = {
			id,
			metadata: { slug: form['metadata[slug]'] ?? '' },
			active: true
		};
		products.push(product);
		return HttpResponse.json(product);
	}),
	http.get('https://api.stripe.com/v1/prices', ({ request }) => {
		const url = new URL(request.url);
		const productId = url.searchParams.get('product');
		const data = prices.filter((p) => !productId || p.product === productId);
		return HttpResponse.json({ object: 'list', data, has_more: false });
	}),
	http.post('https://api.stripe.com/v1/prices', async ({ request }) => {
		counts.pricesPost += 1;
		const form = parseForm(await request.text());
		const id = `price_${prices.length + 1}`;
		const price: Price = {
			id,
			product: form['product'],
			unit_amount: Number(form['unit_amount']),
			currency: form['currency'],
			active: true,
			metadata: { slug: form['metadata[slug]'] ?? '' }
		};
		prices.push(price);
		return HttpResponse.json(price);
	})
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	products = [];
	prices = [];
	counts.productsPost = 0;
	counts.pricesPost = 0;
	const { setStripeForTests } = await import('./client');
	setStripeForTests(null);
});

describe('syncPrices', () => {
	test('idempotent: running twice does not create duplicates', async () => {
		const { syncPrices } = await import('./sync-prices');
		const { PACKS } = await import('$lib/server/tokens/packs');
		await syncPrices();
		expect(counts.productsPost).toBe(PACKS.length);
		expect(counts.pricesPost).toBe(PACKS.length);

		await syncPrices();
		expect(counts.productsPost).toBe(PACKS.length);
		expect(counts.pricesPost).toBe(PACKS.length);
	});

	test('writes resolved stripe_price_id back to token_pack', async () => {
		const { syncPrices } = await import('./sync-prices');
		const { db } = await import('$lib/server/db');
		const { tokenPack } = await import('$lib/server/db/schema');
		const { eq } = await import('drizzle-orm');
		await syncPrices();
		const [row] = await db.select().from(tokenPack).where(eq(tokenPack.slug, 'starter')).limit(1);
		expect(row).toBeTruthy();
		expect(row.stripePriceId.startsWith('price_')).toBe(true);
	});
});
