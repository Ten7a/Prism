import { error, json } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { generationJob, image as imageTbl } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'unauthorized');

	const [job] = await db
		.select()
		.from(generationJob)
		.where(and(eq(generationJob.id, params.id), eq(generationJob.userId, locals.user.id)))
		.limit(1);
	if (!job) throw error(404, 'not found');

	const images = await db
		.select()
		.from(imageTbl)
		.where(eq(imageTbl.jobId, job.id))
		.orderBy(asc(imageTbl.createdAt));

	return json({ job, images });
};
