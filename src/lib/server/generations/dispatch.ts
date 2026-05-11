import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { generationJob, image as imageTbl } from '../db/schema';
import { failJob, finishJob, refundShards, type FinishJobImage } from '../db/queries/jobs';
import { getModel } from '../openrouter/registry';
import { estimateCost } from '../openrouter/pricing';
import { generateOne, type GeneratedImage } from '../openrouter/generate';
import { OpenRouterError } from '../openrouter/client';
import { storage, imageKey } from '../storage';
import { extForMime } from '../storage/keys';
import { publish } from './notify';
import type { Quality, Ratio } from '../openrouter/types';
import { baseLog } from '../log';
import { incCounter } from '../log/metrics';

const log = baseLog.child({ mod: 'dispatch' });

interface ShardOk {
	ok: true;
	i: number;
	images: { row: FinishJobImage; src: GeneratedImage }[];
	costTokens: number;
}
interface ShardErr {
	ok: false;
	i: number;
	code: string;
	costTokens: number;
}

function classifyError(err: unknown): string {
	if (err instanceof OpenRouterError) {
		if (err.status === 429) return 'openrouter_rate_limited';
		if (err.status === 408) return 'openrouter_timeout';
		if (err.status && err.status >= 500) return 'openrouter_5xx';
		if (err.status && err.status >= 400) return 'openrouter_4xx';
		return 'openrouter_error';
	}
	if (err instanceof Error && /fetch|network/i.test(err.message)) return 'network_error';
	return 'internal_error';
}

export async function dispatch(jobId: string, platform?: App.Platform): Promise<void> {
	let userId: string | null = null;
	try {
		const [job] = await db.select().from(generationJob).where(eq(generationJob.id, jobId)).limit(1);
		if (!job) {
			log.warn({ jobId }, 'job not found');
			return;
		}
		userId = job.userId;

		if (job.status === 'cancelled') return;

		await db.update(generationJob).set({ status: 'running' }).where(eq(generationJob.id, jobId));

		const model = await getModel(job.modelId, platform);
		if (!model) {
			await failJob(jobId, 'model_unavailable');
			await publish(jobId, { type: 'error', code: 'model_unavailable' });
			return;
		}

		const quality = job.quality as Quality;
		const ratio = job.ratio as Ratio;

		// Resolve ref images to short-lived signed URLs.
		const store = storage(platform);
		const refImageUrls: string[] = [];
		for (const key of job.refImageKeys ?? []) {
			try {
				refImageUrls.push(await store.signedUrl(key, 600));
			} catch (err) {
				log.warn({ key, err: (err as Error).message }, 'could not sign ref image');
			}
		}

		const perShardTokens = estimateCost(model, { quality, ratio, batch: 1 }).internalTokens;

		await publish(jobId, { type: 'progress', i: 0, total: job.batch });

		const shardPromise = async (i: number): Promise<ShardOk | ShardErr> => {
			try {
				const [snapshot] = await db
					.select({ status: generationJob.status })
					.from(generationJob)
					.where(eq(generationJob.id, jobId))
					.limit(1);
				if (snapshot?.status === 'cancelled') {
					return { ok: false, i, code: 'cancelled', costTokens: perShardTokens };
				}
				const generated = await generateOne(model, {
					prompt: job.prompt,
					quality,
					ratio,
					refImageUrls
				});
				const rows: { row: FinishJobImage; src: GeneratedImage }[] = [];
				for (let k = 0; k < generated.length; k++) {
					const g = generated[k];
					const ext = extForMime(g.mime);
					const key = imageKey(job.userId, jobId, generated.length === 1 ? i : i * 100 + k, ext);
					await store.put(key, g.bytes, { contentType: g.mime });
					rows.push({
						row: {
							r2Key: key,
							width: g.width,
							height: g.height,
							mime: g.mime,
							bytes: g.bytes.byteLength
						},
						src: g
					});
				}
				return { ok: true, i, images: rows, costTokens: perShardTokens };
			} catch (err) {
				const code = classifyError(err);
				log.warn({ jobId, shard: i, err: (err as Error).message }, 'shard failed');
				return { ok: false, i, code, costTokens: perShardTokens };
			}
		};

		const settled = await Promise.all(Array.from({ length: job.batch }, (_, i) => shardPromise(i)));

		const successes = settled.filter((r): r is ShardOk => r.ok);
		const failures = settled.filter((r): r is ShardErr => !r.ok);

		// If the user cancelled mid-flight, the cancel endpoint already wrote the refund and
		// published the cancellation event. Exit without touching status or publishing again.
		if (failures.some((f) => f.code === 'cancelled')) {
			return;
		}

		// Publish image events for successes (with signed URLs).
		const allImages: FinishJobImage[] = [];
		for (const s of successes) {
			for (const img of s.images) {
				allImages.push(img.row);
			}
		}

		const costActual = successes.reduce((sum, s) => sum + s.costTokens, 0);

		if (successes.length === 0) {
			const code = failures[0]?.code ?? 'all_shards_failed';
			await failJob(jobId, code);
			incCounter('prism_generation_total', { status: 'failed' });
			await publish(jobId, { type: 'error', code });
			return;
		}

		// Refund failed shards (partial) or the leftover (if estimate > actual on full success).
		const refundTokens = job.costEstimate - costActual;
		if (refundTokens > 0) {
			await refundShards(jobId, job.userId, refundTokens);
			incCounter('prism_token_refund_total', undefined, refundTokens);
		}

		incCounter('prism_token_debit_total', undefined, costActual);
		incCounter('prism_generation_total', {
			status: failures.length > 0 ? 'partial' : 'ok'
		});

		await finishJob(jobId, allImages, costActual);

		// Now publish per-image events (need image IDs from DB to construct API URLs).
		const insertedImages = await db.select().from(imageTbl).where(eq(imageTbl.jobId, jobId));
		for (const inserted of insertedImages) {
			// Match insertion order back to the shard index by r2Key.
			let shardIdx = 0;
			for (const s of successes) {
				const hit = s.images.find((img) => img.row.r2Key === inserted.r2Key);
				if (hit) {
					shardIdx = s.i;
					break;
				}
			}
			let url: string | undefined;
			try {
				url = await store.signedUrl(inserted.r2Key, 600);
			} catch {
				/* fall through to api redirect path on the client */
			}
			await publish(jobId, {
				type: 'image',
				i: shardIdx,
				imageId: inserted.id,
				key: inserted.r2Key,
				url,
				width: inserted.width,
				height: inserted.height,
				mime: inserted.mime,
				bytes: inserted.bytes
			});
		}

		for (const f of failures) {
			await publish(jobId, { type: 'shard_error', i: f.i, code: f.code });
		}

		await publish(jobId, { type: 'done', costActual });
	} catch (err) {
		log.error({ jobId, err: (err as Error).message }, 'uncaught');
		incCounter('prism_generation_total', { status: 'failed' });
		try {
			await failJob(jobId, 'internal_error');
		} catch (e2) {
			log.error({ jobId, err: (e2 as Error).message }, 'failJob also threw');
		}
		try {
			await publish(jobId, { type: 'error', code: 'internal_error' });
		} catch {
			/* swallow */
		}
	}
}
