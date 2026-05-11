import { env } from '$env/dynamic/private';
import { db } from '../db';
import { tokenLedger } from '../db/schema';

export function isUniqueViolation(e: unknown): boolean {
	if (typeof e !== 'object' || e === null) return false;
	const err = e as { code?: string; cause?: unknown };
	if (err.code === '23505') return true;
	if (err.cause) return isUniqueViolation(err.cause);
	return false;
}

export function dailyAllowanceTokens(): number {
	const raw = env.DAILY_ALLOWANCE_TOKENS;
	const n = raw === undefined || raw === '' ? 10 : Number(raw);
	return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 10;
}

export async function grantDailyAllowanceIfDue(userId: string): Promise<void> {
	const day = new Date().toISOString().slice(0, 10);
	const tokens = dailyAllowanceTokens();
	if (tokens === 0) return;
	try {
		await db.insert(tokenLedger).values({
			userId,
			delta: tokens,
			reason: 'daily_grant',
			dailyGrantDay: day
		});
	} catch (e) {
		if (!isUniqueViolation(e)) throw e;
	}
}
