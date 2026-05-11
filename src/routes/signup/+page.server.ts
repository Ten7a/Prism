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
		const name = String(data.get('name') ?? '').trim() || email.split('@')[0];

		if (!email || !password) {
			return fail(400, { email, name, error: 'Email and password are required.' });
		}
		if (password.length < 8) {
			return fail(400, { email, name, error: 'Password must be at least 8 characters.' });
		}

		try {
			await auth.api.signUpEmail({
				body: { email, password, name },
				headers: request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, { email, name, error: err.body?.message ?? 'Sign up failed.' });
			}
			throw err;
		}

		return { email, name, signedUp: true };
	}
};
