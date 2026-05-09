import { db } from '$lib/server/db';
import { generationJob, image } from '$lib/server/db/schema';
import { imageKey } from '$lib/server/storage/keys';

function delay(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

/**
 * Seed `n` images for the given user, each owned by its own one-shot job.
 * Returns image IDs in `createdAt DESC, id DESC` order — i.e. newest first.
 */
export async function seedImages(userId: string, n: number): Promise<string[]> {
	const ids: { id: string; createdAt: Date }[] = [];
	for (let i = 0; i < n; i++) {
		const [job] = await db
			.insert(generationJob)
			.values({
				userId,
				modelId: 'test/model',
				prompt: `prompt-${i}`,
				ratio: '1:1',
				quality: '1k',
				batch: 1,
				costEstimate: 1,
				status: 'succeeded'
			})
			.returning();

		const [img] = await db
			.insert(image)
			.values({
				jobId: job.id,
				userId,
				r2Key: imageKey(userId, job.id, 0, 'png'),
				width: 1,
				height: 1,
				mime: 'image/png',
				bytes: 1
			})
			.returning();
		ids.push({ id: img.id, createdAt: img.createdAt });
		// Ensure distinct timestamps so cursor ordering is unambiguous.
		await delay(2);
	}
	return ids
		.sort((a, b) => {
			const t = b.createdAt.getTime() - a.createdAt.getTime();
			return t !== 0 ? t : b.id.localeCompare(a.id);
		})
		.map((r) => r.id);
}
