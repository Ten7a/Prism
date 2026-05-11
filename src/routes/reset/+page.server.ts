import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	return { token: url.searchParams.get('token') };
};

export const actions: Actions = {
	request: async ({ request, url }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim();
		if (!email) return fail(400, { email, error: 'Email required.' });

		try {
			await auth.api.requestPasswordReset({
				body: { email, redirectTo: `${url.origin}/reset` },
				headers: request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, { email, error: err.body?.message ?? 'Could not send email.' });
			}
			throw err;
		}
		return { email, sent: true };
	},

	confirm: async ({ request }) => {
		const data = await request.formData();
		const token = String(data.get('token') ?? '');
		const newPassword = String(data.get('password') ?? '');
		if (!token) return fail(400, { error: 'Missing or expired token.' });
		if (newPassword.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.' });
		}

		try {
			await auth.api.resetPassword({
				body: { token, newPassword },
				headers: request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, { error: err.body?.message ?? 'Reset failed.' });
			}
			throw err;
		}
		throw redirect(303, '/login?reset=1');
	}
};
