import { describe, expect, test } from 'vitest';
import { getBalance } from './balance';
import { insertLedger, seedUser } from './test-helpers';

describe('balance', () => {
	test('balance equals signed sum of ledger deltas', async () => {
		const u = await seedUser();
		await insertLedger(u.id, +10, 'daily_grant', { day: '2026-05-09' });
		await insertLedger(u.id, +100, 'pack_purchase', { stripeEventId: `evt_1_${crypto.randomUUID()}` });
		await insertLedger(u.id, -8, 'generation_debit');
		expect(await getBalance(u.id)).toBe(102);
	});

	test('balance is 0 for a user with no ledger rows', async () => {
		const u = await seedUser();
		expect(await getBalance(u.id)).toBe(0);
	});

	test('daily_grant insert is idempotent per UTC day', async () => {
		const u = await seedUser();
		await insertLedger(u.id, +10, 'daily_grant', { day: '2026-05-09' });
		await expect(
			insertLedger(u.id, +10, 'daily_grant', { day: '2026-05-09' })
		).rejects.toThrow();
	});

	test('daily_grant allows different days for the same user', async () => {
		const u = await seedUser();
		await insertLedger(u.id, +10, 'daily_grant', { day: '2026-05-09' });
		await insertLedger(u.id, +10, 'daily_grant', { day: '2026-05-10' });
		expect(await getBalance(u.id)).toBe(20);
	});

	test('stripe webhook idempotency: same event credits once', async () => {
		const u = await seedUser();
		const evt = `evt_42_${crypto.randomUUID()}`;
		await insertLedger(u.id, +100, 'pack_purchase', { stripeEventId: evt });
		await expect(
			insertLedger(u.id, +100, 'pack_purchase', { stripeEventId: evt })
		).rejects.toThrow();
	});
});
