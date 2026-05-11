import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { tokenPack, user as userTable } from '$lib/server/db/schema';
import { stripe } from '$lib/server/stripe/client';
import type { RequestHandler } from './$types';

async function readPackSlug(request: Request): Promise<string | null> {
	const ct = request.headers.get('content-type') ?? '';
	if (ct.includes('application/json')) {
		try {
			const body = (await request.json()) as { pack?: string };
			return body.pack ?? null;
		} catch {
			return null;
		}
	}
	const form = await request.formData();
	const v = form.get('pack');
	return typeof v === 'string' ? v : null;
}

async function ensureCustomer(
	userId: string,
	email: string,
	existing: string | null | undefined
): Promise<string> {
	if (existing) return existing;
	const customer = await stripe().customers.create({ email, metadata: { userId } });
	await db.update(userTable).set({ stripeCustomerId: customer.id }).where(eq(userTable.id, userId));
	return customer.id;
}

export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (!locals.user) throw error(401, 'unauthorized');
	const slug = await readPackSlug(request);
	if (!slug) throw error(400, 'pack required');

	const [pack] = await db.select().from(tokenPack).where(eq(tokenPack.slug, slug)).limit(1);
	if (!pack || !pack.active) throw error(400, 'unknown pack');
	if (pack.stripePriceId.startsWith('seed:')) {
		throw error(500, 'pack not synced to Stripe; run sync-prices');
	}

	const [u] = await db
		.select({ email: userTable.email, stripeCustomerId: userTable.stripeCustomerId })
		.from(userTable)
		.where(eq(userTable.id, locals.user.id))
		.limit(1);
	if (!u) throw error(401, 'unauthorized');

	const customerId = await ensureCustomer(locals.user.id, u.email, u.stripeCustomerId);

	const origin = env.ORIGIN || url.origin;
	const session = await stripe().checkout.sessions.create({
		mode: 'payment',
		customer: customerId,
		line_items: [{ price: pack.stripePriceId, quantity: 1 }],
		metadata: { userId: locals.user.id, packSlug: pack.slug },
		payment_intent_data: {
			metadata: { userId: locals.user.id, packSlug: pack.slug }
		},
		success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${origin}/billing/cancel`
	});

	if (!session.url) throw error(502, 'stripe did not return a checkout url');
	throw redirect(303, session.url);
};
