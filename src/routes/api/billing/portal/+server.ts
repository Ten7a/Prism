import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/schema';
import { stripe } from '$lib/server/stripe/client';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'unauthorized');

	const [u] = await db
		.select({ stripeCustomerId: userTable.stripeCustomerId })
		.from(userTable)
		.where(eq(userTable.id, locals.user.id))
		.limit(1);
	if (!u?.stripeCustomerId) throw error(400, 'no billing history');

	const origin = env.ORIGIN || url.origin;
	const session = await stripe().billingPortal.sessions.create({
		customer: u.stripeCustomerId,
		return_url: `${origin}/account`
	});

	throw redirect(303, session.url);
};
