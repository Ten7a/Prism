import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { eq } from 'drizzle-orm';

process.env.OPENROUTER_API_KEY = 'or_test_dummy';
process.env.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';

// Stub storage so dispatch never touches S3/R2.
const putCalls: { key: string; bytes: number }[] = [];
vi.mock('$lib/server/storage', async () => {
	const keys = await import('$lib/server/storage/keys');
	return {
		...keys,
		storage: () => ({
			put: async (key: string, body: Uint8Array) => {
				putCalls.push({ key, bytes: body.byteLength });
			},
			delete: async () => {},
			signedUrl: async (key: string) => `https://signed.test/${encodeURIComponent(key)}`
		}),
		bulkDelete: async () => {}
	};
});

// Stub the model registry to avoid network.
import type { ModelEntry } from '../openrouter/types';

const seedreamModel: ModelEntry = {
	id: 'bytedance-seed/seedream-4.5',
	displayName: 'Seedream',
	capabilities: { textToImage: true, imageToImage: true, edit: true },
	supportedQualities: ['1k', '2k', '4k'],
	supportedRatios: ['1:1', '16:9'],
	pricing: { shape: 'per-image-flat', usd: 0.04 },
	fetchedAt: 0
};

vi.mock('../openrouter/registry', () => ({
	loadModels: async () => [seedreamModel],
	getModel: async (id: string) => (id === seedreamModel.id ? seedreamModel : null),
	_resetCacheForTests: () => {}
}));

import { db } from '../db/index';
import { generationJob, image as imageTbl } from '../db/schema';
import { createJob } from '../db/queries/jobs';
import { getBalance } from '../db/queries/balance';
import { insertLedger, seedUser } from '../db/queries/test-helpers';
import { dispatch } from './dispatch';
import { _resetSubscribersForTests } from './notify';

const PNG_1x1_B64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

let shardCalls = 0;
let imagesEndpointBehavior: 'ok' | 'fail' | 'alternate' = 'ok';

const server = setupServer(
	http.post('https://openrouter.test/api/v1/images/generations', () => {
		shardCalls += 1;
		if (imagesEndpointBehavior === 'fail') {
			return HttpResponse.json({ error: 'down' }, { status: 500 });
		}
		if (imagesEndpointBehavior === 'alternate' && shardCalls % 2 === 0) {
			return HttpResponse.json({ error: 'down' }, { status: 500 });
		}
		return HttpResponse.json({ data: [{ b64_json: PNG_1x1_B64 }] });
	})
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
	server.resetHandlers();
	shardCalls = 0;
	imagesEndpointBehavior = 'ok';
	putCalls.length = 0;
	_resetSubscribersForTests();
});
afterAll(() => server.close());

beforeEach(() => {
	imagesEndpointBehavior = 'ok';
});

const baseJobInput = {
	modelId: seedreamModel.id,
	prompt: 'a cat',
	ratio: '1:1' as const,
	quality: '1k' as const
};

describe('dispatch', () => {
	test('happy path: 1k batch=1 debits → uploads → finishes', async () => {
		const u = await seedUser();
		await insertLedger(u.id, +100, 'pack_purchase', {
			stripeEventId: `evt_${crypto.randomUUID()}`
		});

		const job = await createJob({
			userId: u.id,
			...baseJobInput,
			batch: 1,
			costEstimate: 4
		});
		expect(await getBalance(u.id)).toBe(96);

		await dispatch(job.id);

		const [updated] = await db.select().from(generationJob).where(eq(generationJob.id, job.id));
		expect(updated.status).toBe('succeeded');
		expect(updated.costActual).toBe(4);

		const imgs = await db.select().from(imageTbl).where(eq(imageTbl.jobId, job.id));
		expect(imgs).toHaveLength(1);

		expect(await getBalance(u.id)).toBe(96);
		expect(putCalls).toHaveLength(1);
	});

	test('all-fail refunds the full estimate', async () => {
		imagesEndpointBehavior = 'fail';
		const u = await seedUser();
		await insertLedger(u.id, +100, 'pack_purchase', {
			stripeEventId: `evt_${crypto.randomUUID()}`
		});
		const before = await getBalance(u.id);

		const job = await createJob({
			userId: u.id,
			...baseJobInput,
			batch: 2,
			costEstimate: 8
		});

		await dispatch(job.id);

		const [updated] = await db.select().from(generationJob).where(eq(generationJob.id, job.id));
		expect(updated.status).toBe('failed');
		expect(await getBalance(u.id)).toBe(before);
	});

	test('partial batch failure refunds only failed shards', async () => {
		imagesEndpointBehavior = 'alternate'; // shards 1 and 3 fail (2nd, 4th call)
		const u = await seedUser();
		await insertLedger(u.id, +100, 'pack_purchase', {
			stripeEventId: `evt_${crypto.randomUUID()}`
		});

		const job = await createJob({
			userId: u.id,
			...baseJobInput,
			batch: 4,
			costEstimate: 16 // 4 tokens per shard
		});
		expect(await getBalance(u.id)).toBe(84);

		await dispatch(job.id);

		const [updated] = await db.select().from(generationJob).where(eq(generationJob.id, job.id));
		expect(updated.status).toBe('succeeded');

		const imgs = await db.select().from(imageTbl).where(eq(imageTbl.jobId, job.id));
		expect(imgs).toHaveLength(2);

		// 2 shards succeeded × 4 tokens = 8 actually charged; 8 refunded.
		expect(updated.costActual).toBe(8);
		expect(await getBalance(u.id)).toBe(92);
	});

	test('unknown model fails the job and refunds', async () => {
		const u = await seedUser();
		await insertLedger(u.id, +100, 'pack_purchase', {
			stripeEventId: `evt_${crypto.randomUUID()}`
		});
		const before = await getBalance(u.id);

		const job = await createJob({
			userId: u.id,
			...baseJobInput,
			modelId: 'no-such/model',
			batch: 1,
			costEstimate: 4
		});

		await dispatch(job.id);

		const [updated] = await db.select().from(generationJob).where(eq(generationJob.id, job.id));
		expect(updated.status).toBe('failed');
		expect(updated.errorCode).toBe('model_unavailable');
		expect(await getBalance(u.id)).toBe(before);
	});
});
