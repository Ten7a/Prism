import { sql, eq } from 'drizzle-orm';
import { db } from '../index';
import { tokenLedger } from '../schema';

export async function getBalance(userId: string): Promise<number> {
	const [row] = await db
		.select({ total: sql<number>`coalesce(sum(${tokenLedger.delta}), 0)::int` })
		.from(tokenLedger)
		.where(eq(tokenLedger.userId, userId));
	return row?.total ?? 0;
}
