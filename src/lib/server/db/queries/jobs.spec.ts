import { describe, expect, test } from 'vitest';
import { getBalance } from './balance';
import { createJob, failJob, finishJob } from './jobs';
import { insertLedger, seedUser } from './test-helpers';

const baseJobInput = {
	modelId: 'test-model',
	prompt: 'cat',
	ratio: '1:1',
	quality: '1k',
	batch: 1
};

describe('jobs', () => {
	test('createJob debits and links ledger row to job atomically', async () => {
		const u = await seedUser();
		await insertLedger(u.id, +50, 'pack_purchase', {
			stripeEventId: `evt_seed_${crypto.randomUUID()}`
		});

		const job = await createJob({ userId: u.id, costEstimate: 5, ...baseJobInput });

		expect(job.status).toBe('queued');
		expect(await getBalance(u.id)).toBe(45);
	});

	test('failJob refunds the estimate', async () => {
		const u = await seedUser();
		await insertLedger(u.id, +50, 'pack_purchase', {
			stripeEventId: `evt_fail_${crypto.randomUUID()}`
		});
		const job = await createJob({ userId: u.id, costEstimate: 5, ...baseJobInput });
		expect(await getBalance(u.id)).toBe(45);

		await failJob(job.id, 'provider_timeout');
		expect(await getBalance(u.id)).toBe(50);
	});

	test('finishJob marks job succeeded and records images', async () => {
		const u = await seedUser();
		await insertLedger(u.id, +50, 'pack_purchase', {
			stripeEventId: `evt_finish_${crypto.randomUUID()}`
		});
		const job = await createJob({ userId: u.id, costEstimate: 5, ...baseJobInput });

		await finishJob(
			job.id,
			[{ r2Key: 'img/1.png', width: 1024, height: 1024, mime: 'image/png', bytes: 1234 }],
			5
		);

		expect(await getBalance(u.id)).toBe(45);
	});
});
