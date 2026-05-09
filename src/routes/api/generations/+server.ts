import { error, json } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { generationJob } from '$lib/server/db/schema';
import { createJob } from '$lib/server/db/queries/jobs';
import { getBalance } from '$lib/server/db/queries/balance';
import { getModel } from '$lib/server/openrouter/registry';
import { estimateCost } from '$lib/server/openrouter/pricing';
import { dispatch } from '$lib/server/generations/dispatch';
import type { Quality, Ratio } from '$lib/server/openrouter/types';

const ALLOWED_RATIOS: Ratio[] = ['1:1', '4:3', '3:4', '16:9', '9:16'];
const ALLOWED_QUALITIES: Quality[] = ['1k', '2k', '4k'];

interface GenerateBody {
	model?: unknown;
	prompt?: unknown;
	ratio?: unknown;
	quality?: unknown;
	batch?: unknown;
	refImageKeys?: unknown;
}

function validate(body: GenerateBody): {
	model: string;
	prompt: string;
	ratio: Ratio;
	quality: Quality;
	batch: number;
	refImageKeys: string[];
} {
	const model = typeof body.model === 'string' ? body.model.trim() : '';
	const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
	const ratio = body.ratio as Ratio;
	const quality = body.quality as Quality;
	const batchRaw = body.batch ?? 1;
	const batch = typeof batchRaw === 'number' ? batchRaw : Number(batchRaw);
	const refImageKeys = Array.isArray(body.refImageKeys)
		? body.refImageKeys.filter((k): k is string => typeof k === 'string')
		: [];

	if (!model) throw error(400, 'model is required');
	if (prompt.length < 1 || prompt.length > 4000)
		throw error(400, 'prompt must be 1–4000 characters');
	if (!ALLOWED_RATIOS.includes(ratio)) throw error(400, 'invalid ratio');
	if (!ALLOWED_QUALITIES.includes(quality)) throw error(400, 'invalid quality');
	if (!Number.isInteger(batch) || batch < 1 || batch > 4)
		throw error(400, 'batch must be an integer 1–4');

	return { model, prompt, ratio, quality, batch, refImageKeys };
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) throw error(401, 'unauthorized');

	const body = (await request.json().catch(() => ({}))) as GenerateBody;
	const input = validate(body);

	const modelEntry = await getModel(input.model, platform);
	if (!modelEntry) throw error(400, 'unknown model');

	const cost = estimateCost(modelEntry, {
		quality: input.quality,
		ratio: input.ratio,
		batch: input.batch
	});

	const balance = await getBalance(locals.user.id);
	if (balance < cost.internalTokens) {
		throw error(402, 'insufficient balance');
	}

	const job = await createJob({
		userId: locals.user.id,
		modelId: input.model,
		prompt: input.prompt,
		refImageKeys: input.refImageKeys,
		ratio: input.ratio,
		quality: input.quality,
		batch: input.batch,
		costEstimate: cost.internalTokens
	});

	const work = dispatch(job.id, platform);
	if (platform?.context?.waitUntil) {
		platform.context.waitUntil(work);
	} else {
		void work;
	}

	return json({ id: job.id }, { status: 201 });
};

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'unauthorized');
	const rows = await db
		.select({
			id: generationJob.id,
			modelId: generationJob.modelId,
			status: generationJob.status,
			batch: generationJob.batch,
			costEstimate: generationJob.costEstimate,
			costActual: generationJob.costActual,
			createdAt: generationJob.createdAt,
			finishedAt: generationJob.finishedAt
		})
		.from(generationJob)
		.where(eq(generationJob.userId, locals.user.id))
		.orderBy(desc(generationJob.createdAt))
		.limit(50);
	return json({ jobs: rows });
};
