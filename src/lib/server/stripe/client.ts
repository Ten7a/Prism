import Stripe from 'stripe';
import { env } from '$env/dynamic/private';

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
	if (!_stripe) {
		if (!env.STRIPE_SECRET_KEY) {
			throw new Error('STRIPE_SECRET_KEY is not configured');
		}
		_stripe = new Stripe(env.STRIPE_SECRET_KEY, {
			apiVersion: '2026-04-22.dahlia',
			httpClient: Stripe.createFetchHttpClient()
		});
	}
	return _stripe;
}

export function setStripeForTests(client: Stripe | null): void {
	_stripe = client;
}
