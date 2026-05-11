import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { tokenLedger } from '../db/schema';
import { getBalance } from '../db/queries/balance';
import { seedUser } from '../db/queries/test-helpers';
import { grantDailyAllowanceIfDue } from './grant';

async function ledgerCount(userId: string): Promise<number> {
	const rows = await db.execute<{ count: number }>(
		sql`select count(*)::int as count from ${tokenLedger} where user_id = ${userId}`
	);
	return rows[0]?.count ?? 0;
}

describe('grantDailyAllowanceIfDue', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	test('grants 10 tokens on first call of the day', async () => {
		const u = await seedUser();
		await grantDailyAllowanceIfDue(u.id);
		expect(await getBalance(u.id)).toBe(10);
	});

	test('second call same UTC day is a no-op', async () => {
		const u = await seedUser();
		await grantDailyAllowanceIfDue(u.id);
		await grantDailyAllowanceIfDue(u.id);
		expect(await getBalance(u.id)).toBe(10);
		expect(await ledgerCount(u.id)).toBe(1);
	});

	test('next UTC day grants again', async () => {
		const u = await seedUser();
		vi.setSystemTime(new Date('2026-05-09T23:59:00Z'));
		await grantDailyAllowanceIfDue(u.id);
		vi.setSystemTime(new Date('2026-05-10T00:00:01Z'));
		await grantDailyAllowanceIfDue(u.id);
		expect(await getBalance(u.id)).toBe(20);
		expect(await ledgerCount(u.id)).toBe(2);
	});

	test('parallel grants race to a single ledger row', async () => {
		const u = await seedUser();
		await Promise.all(Array.from({ length: 5 }, () => grantDailyAllowanceIfDue(u.id)));
		expect(await getBalance(u.id)).toBe(10);
		expect(await ledgerCount(u.id)).toBe(1);
	});
});
