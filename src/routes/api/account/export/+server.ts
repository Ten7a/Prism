import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { consentRecord, generationJob, image, tokenLedger } from '$lib/server/db/schema';
import { user as userTable } from '$lib/server/db/auth.schema';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'unauthorized');
	const userId = locals.user.id;

	const [userRows, ledger, jobs, images, consents] = await Promise.all([
		db
			.select({
				id: userTable.id,
				email: userTable.email,
				name: userTable.name,
				emailVerified: userTable.emailVerified,
				createdAt: userTable.createdAt,
				updatedAt: userTable.updatedAt,
				stripeCustomerId: userTable.stripeCustomerId
			})
			.from(userTable)
			.where(eq(userTable.id, userId))
			.limit(1),
		db.select().from(tokenLedger).where(eq(tokenLedger.userId, userId)),
		db.select().from(generationJob).where(eq(generationJob.userId, userId)),
		db
			.select({
				id: image.id,
				jobId: image.jobId,
				r2Key: image.r2Key,
				width: image.width,
				height: image.height,
				mime: image.mime,
				bytes: image.bytes,
				createdAt: image.createdAt
			})
			.from(image)
			.where(eq(image.userId, userId)),
		db.select().from(consentRecord).where(eq(consentRecord.userId, userId))
	]);

	const payload = {
		exportedAt: new Date().toISOString(),
		user: userRows[0] ?? null,
		ledger,
		jobs,
		images,
		consents
	};

	return new Response(JSON.stringify(payload, null, 2), {
		status: 200,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="prism-export-${userId}-${Date.now()}.json"`,
			'cache-control': 'no-store'
		}
	});
};
