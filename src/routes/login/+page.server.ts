import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) throw redirect(303, '/account');
	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim();
		const password = String(data.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { email, error: 'Email and password are required.' });
		}

		try {
			await auth.api.signInEmail({
				body: { email, password },
				headers: request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				const msg = err.body?.message ?? 'Sign in failed.';
				const unverified = msg.toLowerCase().includes('not verified');
				return fail(401, { email, error: msg, unverified });
			}
			throw err;
		}

		throw redirect(303, '/account');
	},

	resend: async ({ request }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim();
		if (!email) return fail(400, { email, error: 'Email required.' });

		try {
			await auth.api.sendVerificationEmail({
				body: { email, callbackURL: '/verify' },
				headers: request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, { email, error: err.body?.message ?? 'Could not send email.' });
			}
			throw err;
		}
		return { email, resent: true };
	}
};
