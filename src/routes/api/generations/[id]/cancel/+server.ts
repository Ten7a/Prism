import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { generationJob } from '$lib/server/db/schema';
import { cancelJob } from '$lib/server/db/queries/jobs';
import { publish } from '$lib/server/generations/notify';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'unauthorized');
	const id = params.id;
	if (!id) throw error(400, 'missing id');

	const [job] = await db
		.select({ id: generationJob.id, userId: generationJob.userId, status: generationJob.status })
		.from(generationJob)
		.where(eq(generationJob.id, id))
		.limit(1);

	// 404 (not 403) when missing or owned by someone else, to avoid leaking ids.
	if (!job || job.userId !== locals.user.id) throw error(404, 'not found');
	if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
		throw error(409, 'job already terminal');
	}

	const result = await cancelJob(id, locals.user.id);
	if (result.status === 'already_terminal') throw error(409, 'job already terminal');

	await publish(id, { type: 'error', code: 'cancelled' });
	return json({ id, status: 'cancelled' });
};
