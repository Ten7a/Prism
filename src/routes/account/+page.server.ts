import { redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { image } from '$lib/server/db/schema';
import { getBalance } from '$lib/server/db/queries/balance';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	const [balance, recent] = await Promise.all([
		getBalance(locals.user.id),
		db
			.select({
				id: image.id,
				jobId: image.jobId,
				createdAt: image.createdAt
			})
			.from(image)
			.where(eq(image.userId, locals.user.id))
			.orderBy(desc(image.createdAt))
			.limit(10)
	]);

	return {
		email: locals.user.email,
		emailVerified: locals.user.emailVerified,
		balance,
		recent
	};
};
