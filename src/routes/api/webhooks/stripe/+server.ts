import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type Stripe from 'stripe';
import { db } from '$lib/server/db';
import { tokenLedger, tokenPack, user as userTable } from '$lib/server/db/schema';
import { stripe } from '$lib/server/stripe/client';
import { isUniqueViolation } from '$lib/server/tokens/grant';
import { sendMail } from '$lib/server/email/resend';
import { receiptTemplate } from '$lib/server/email/templates/receipt';
import type { RequestHandler } from './$types';
import { baseLog } from '$lib/server/log';

const log = baseLog.child({ mod: 'stripe-webhook' });

async function creditPurchase(event: Stripe.Event): Promise<{ emailJob: Promise<void> | null }> {
	const session = event.data.object as Stripe.Checkout.Session;
	const userId = session.metadata?.userId;
	const packSlug = session.metadata?.packSlug;
	if (!userId || !packSlug) {
		log.warn({ eventId: event.id }, 'checkout.session.completed missing metadata');
		return { emailJob: null };
	}

	const [pack] = await db.select().from(tokenPack).where(eq(tokenPack.slug, packSlug)).limit(1);
	if (!pack) {
		log.warn({ packSlug }, 'unknown pack slug');
		return { emailJob: null };
	}

	try {
		await db.insert(tokenLedger).values({
			userId,
			delta: pack.tokens,
			reason: 'pack_purchase',
			stripeEventId: event.id
		});
	} catch (e) {
		if (isUniqueViolation(e)) return { emailJob: null };
		throw e;
	}

	const [u] = await db
		.select({ email: userTable.email })
		.from(userTable)
		.where(eq(userTable.id, userId))
		.limit(1);
	if (!u) return { emailJob: null };

	const tmpl = receiptTemplate(u.email, {
		amountCents: session.amount_total ?? pack.priceCents,
		tokens: pack.tokens
	});
	const job = sendMail({
		to: u.email,
		subject: tmpl.subject,
		html: tmpl.html,
		text: tmpl.text
	}).catch((err) =>
		log.error({ err: (err as Error)?.message ?? String(err) }, 'receipt email failed')
	);
	return { emailJob: job };
}

async function reverseRefund(event: Stripe.Event): Promise<void> {
	const charge = event.data.object as Stripe.Charge;
	const piId =
		typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
	if (!piId) return;
	const pi = await stripe().paymentIntents.retrieve(piId);
	const userId = pi.metadata?.userId;
	const packSlug = pi.metadata?.packSlug;
	if (!userId || !packSlug) return;
	const [pack] = await db.select().from(tokenPack).where(eq(tokenPack.slug, packSlug)).limit(1);
	if (!pack) return;

	try {
		await db.insert(tokenLedger).values({
			userId,
			delta: -pack.tokens,
			reason: 'admin_adjustment',
			stripeEventId: event.id
		});
	} catch (e) {
		if (!isUniqueViolation(e)) throw e;
	}
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const sig = request.headers.get('stripe-signature');
	const secret = env.STRIPE_WEBHOOK_SECRET;
	if (!sig || !secret) return new Response('missing signature', { status: 400 });

	const body = await request.text();
	let event: Stripe.Event;
	try {
		event = await stripe().webhooks.constructEventAsync(body, sig, secret);
	} catch (err) {
		log.warn({ err: (err as Error)?.message ?? String(err) }, 'signature verification failed');
		return new Response('bad signature', { status: 400 });
	}

	const waitUntil = platform?.context?.waitUntil;

	switch (event.type) {
		case 'checkout.session.completed': {
			const { emailJob } = await creditPurchase(event);
			if (emailJob && waitUntil) waitUntil(emailJob);
			break;
		}
		case 'charge.refunded': {
			await reverseRefund(event);
			break;
		}
		default:
			break;
	}

	return new Response('ok', { status: 200 });
};
