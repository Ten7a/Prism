import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { image, user as userTable } from '$lib/server/db/schema';
import { bulkDelete } from '$lib/server/storage';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, cookies, platform }) => {
		if (!locals.user) throw redirect(303, '/login');

		const data = await request.formData();
		const password = String(data.get('password') ?? '');
		if (!password) return fail(400, { error: 'Password required.' });

		try {
			await auth.api.signInEmail({
				body: { email: locals.user.email, password },
				headers: request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, { error: 'Password incorrect.' });
			}
			throw err;
		}

		const userId = locals.user.id;

		const keys = await db
			.select({ r2Key: image.r2Key })
			.from(image)
			.where(eq(image.userId, userId));

		await db.delete(userTable).where(eq(userTable.id, userId));

		await bulkDelete(
			keys.map((k) => k.r2Key),
			platform
		);

		for (const name of cookies.getAll().map((c) => c.name)) {
			cookies.delete(name, { path: '/' });
		}

		throw redirect(303, '/');
	}
};
