import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import Stripe from 'stripe';

vi.mock('$env/dynamic/private', async () => {
	const actual =
		await vi.importActual<typeof import('$env/dynamic/private')>('$env/dynamic/private');
	return {
		env: {
			...actual.env,
			STRIPE_SECRET_KEY: 'sk_test_dummy',
			STRIPE_WEBHOOK_SECRET: 'whsec_test_dummy',
			EMAIL_OUTBOX_DIR: actual.env.EMAIL_OUTBOX_DIR || '/tmp/prism-email-outbox-test'
		}
	};
});

vi.mock('$app/environment', () => ({ building: false, dev: true }));

const stripeForSigning = new Stripe('sk_test_dummy', {
	apiVersion: '2026-04-22.dahlia',
	httpClient: Stripe.createFetchHttpClient()
});

function signedRequest(payload: object, secret = 'whsec_test_dummy'): Request {
	const body = JSON.stringify(payload);
	const header = stripeForSigning.webhooks.generateTestHeaderString({ payload: body, secret });
	return new Request('http://localhost/api/webhooks/stripe', {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'stripe-signature': header },
		body
	});
}

const piMetadata = new Map<string, { userId: string; packSlug: string }>();

beforeAll(async () => {
	const realStripe = new Stripe('sk_test_dummy', {
		apiVersion: '2026-04-22.dahlia',
		httpClient: Stripe.createFetchHttpClient()
	});
	(realStripe.paymentIntents as { retrieve: unknown }).retrieve = (id: string) =>
		Promise.resolve({ id, metadata: piMetadata.get(id) ?? {} });
	const { setStripeForTests } = await import('$lib/server/stripe/client');
	setStripeForTests(realStripe);
});

afterAll(async () => {
	const { setStripeForTests } = await import('$lib/server/stripe/client');
	setStripeForTests(null);
});

async function freshSeedPack(slug: string, tokens: number, priceCents: number): Promise<void> {
	const { db } = await import('$lib/server/db');
	const { tokenPack } = await import('$lib/server/db/schema');
	await db
		.insert(tokenPack)
		.values({
			slug,
			name: `${tokens} tokens`,
			tokens,
			priceCents,
			stripePriceId: `price_test_${slug}_${Date.now()}`,
			active: true
		})
		.onConflictDoNothing({ target: tokenPack.slug });
}

beforeEach(async () => {
	await freshSeedPack('starter', 100, 500);
	piMetadata.clear();
});

describe('stripe webhook', () => {
	test('valid signed checkout.session.completed credits exactly once on replay', async () => {
		const { POST } = await import('./+server');
		const { seedUser } = await import('$lib/server/db/queries/test-helpers');
		const { getBalance } = await import('$lib/server/db/queries/balance');
		const u = await seedUser();
		const eventId = `evt_test_${crypto.randomUUID()}`;
		const payload = {
			id: eventId,
			type: 'checkout.session.completed',
			data: {
				object: {
					id: 'cs_test_1',
					metadata: { userId: u.id, packSlug: 'starter' },
					amount_total: 500
				}
			}
		};

		const res1 = await POST({ request: signedRequest(payload), platform: undefined } as never);
		expect(res1.status).toBe(200);
		expect(await getBalance(u.id)).toBe(100);

		const res2 = await POST({ request: signedRequest(payload), platform: undefined } as never);
		expect(res2.status).toBe(200);
		expect(await getBalance(u.id)).toBe(100);
	});

	test('invalid signature returns 400', async () => {
		const { POST } = await import('./+server');
		const body = JSON.stringify({
			id: 'evt_x',
			type: 'checkout.session.completed',
			data: { object: {} }
		});
		const req = new Request('http://localhost/api/webhooks/stripe', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
			body
		});
		const res = await POST({ request: req, platform: undefined } as never);
		expect(res.status).toBe(400);
	});

	test('charge.refunded reverses an earlier credit', async () => {
		const { POST } = await import('./+server');
		const { seedUser } = await import('$lib/server/db/queries/test-helpers');
		const { getBalance } = await import('$lib/server/db/queries/balance');
		const u = await seedUser();

		const creditEvent = {
			id: `evt_credit_${crypto.randomUUID()}`,
			type: 'checkout.session.completed',
			data: {
				object: {
					id: 'cs_test_2',
					metadata: { userId: u.id, packSlug: 'starter' },
					amount_total: 500
				}
			}
		};
		await POST({ request: signedRequest(creditEvent), platform: undefined } as never);
		expect(await getBalance(u.id)).toBe(100);

		const piId = `pi_test_${crypto.randomUUID()}`;
		piMetadata.set(piId, { userId: u.id, packSlug: 'starter' });
		const refundEvent = {
			id: `evt_refund_${crypto.randomUUID()}`,
			type: 'charge.refunded',
			data: {
				object: {
					id: 'ch_test_1',
					payment_intent: piId
				}
			}
		};
		const res = await POST({ request: signedRequest(refundEvent), platform: undefined } as never);
		expect(res.status).toBe(200);
		expect(await getBalance(u.id)).toBe(0);
	});
});
