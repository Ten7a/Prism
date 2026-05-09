import { db } from '../index';
import { tokenLedger, user } from '../schema';

let userCounter = 0;

export async function seedUser(): Promise<typeof user.$inferSelect> {
	userCounter += 1;
	const id = `test-user-${process.pid}-${Date.now()}-${userCounter}`;
	const [row] = await db
		.insert(user)
		.values({
			id,
			name: 'Test User',
			email: `${id}@test.local`,
			emailVerified: false,
			updatedAt: new Date()
		})
		.returning();
	return row;
}

export type InsertLedgerOpts = {
	day?: string;
	stripeEventId?: string;
	jobId?: string;
};

export async function insertLedger(
	userId: string,
	delta: number,
	reason: typeof tokenLedger.$inferInsert.reason,
	opts: InsertLedgerOpts = {}
): Promise<void> {
	await db.insert(tokenLedger).values({
		userId,
		delta,
		reason,
		dailyGrantDay: opts.day ?? null,
		stripeEventId: opts.stripeEventId ?? null,
		jobId: opts.jobId ?? null
	});
}

