import { getBalance } from '../db/queries/balance';
import { grantDailyAllowanceIfDue } from './grant';

export async function getEffectiveBalance(userId: string): Promise<number> {
	await grantDailyAllowanceIfDue(userId);
	return getBalance(userId);
}

export function nextUtcMidnightISO(now: Date = new Date()): string {
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
	).toISOString();
}
