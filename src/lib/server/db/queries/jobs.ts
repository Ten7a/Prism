import { eq } from 'drizzle-orm';
import { db } from '../index';
import { generationJob, image, tokenLedger } from '../schema';

export type CreateJobInput = {
	userId: string;
	modelId: string;
	prompt: string;
	refImageKeys?: string[];
	ratio: string;
	quality: string;
	batch?: number;
	costEstimate: number;
};

export type GenerationJob = typeof generationJob.$inferSelect;
export type Image = typeof image.$inferSelect;

export type FinishJobImage = {
	r2Key: string;
	width: number;
	height: number;
	mime: string;
	bytes: number;
};

export async function createJob(input: CreateJobInput): Promise<GenerationJob> {
	return db.transaction(async (tx) => {
		const [job] = await tx
			.insert(generationJob)
			.values({
				userId: input.userId,
				modelId: input.modelId,
				prompt: input.prompt,
				refImageKeys: input.refImageKeys ?? [],
				ratio: input.ratio,
				quality: input.quality,
				batch: input.batch ?? 1,
				costEstimate: input.costEstimate
			})
			.returning();

		await tx.insert(tokenLedger).values({
			userId: input.userId,
			delta: -input.costEstimate,
			reason: 'generation_debit',
			jobId: job.id
		});

		return job;
	});
}

export async function finishJob(
	jobId: string,
	images: FinishJobImage[],
	costActual: number
): Promise<void> {
	await db.transaction(async (tx) => {
		const [job] = await tx
			.update(generationJob)
			.set({ status: 'succeeded', costActual, finishedAt: new Date() })
			.where(eq(generationJob.id, jobId))
			.returning();

		if (!job) throw new Error(`generation_job ${jobId} not found`);

		if (images.length > 0) {
			await tx.insert(image).values(
				images.map((img) => ({
					jobId: job.id,
					userId: job.userId,
					r2Key: img.r2Key,
					width: img.width,
					height: img.height,
					mime: img.mime,
					bytes: img.bytes
				}))
			);
		}
	});
}

export async function failJob(jobId: string, errorCode: string): Promise<void> {
	await db.transaction(async (tx) => {
		const [job] = await tx
			.update(generationJob)
			.set({ status: 'failed', errorCode, finishedAt: new Date() })
			.where(eq(generationJob.id, jobId))
			.returning();

		if (!job) throw new Error(`generation_job ${jobId} not found`);

		await tx.insert(tokenLedger).values({
			userId: job.userId,
			delta: job.costEstimate,
			reason: 'generation_refund',
			jobId: job.id
		});
	});
}
