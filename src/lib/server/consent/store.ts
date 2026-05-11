import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { consentRecord } from '../db/schema';

export type ConsentIdentity = { userId?: string | null; anonId?: string | null };

export type ConsentInput = ConsentIdentity & {
	version: string;
	necessary: boolean;
	analytics: boolean;
	ads: boolean;
};

export type ConsentRow = typeof consentRecord.$inferSelect;

function identityFilter({ userId, anonId }: ConsentIdentity) {
	if (userId) return and(eq(consentRecord.userId, userId), isNull(consentRecord.anonId));
	if (anonId) return and(eq(consentRecord.anonId, anonId), isNull(consentRecord.userId));
	return undefined;
}

export async function upsertConsent(input: ConsentInput): Promise<ConsentRow> {
	if (!input.userId && !input.anonId) {
		throw new Error('upsertConsent requires userId or anonId');
	}
	const [row] = await db
		.insert(consentRecord)
		.values({
			userId: input.userId ?? null,
			anonId: input.userId ? null : (input.anonId ?? null),
			version: input.version,
			necessary: input.necessary,
			analytics: input.analytics,
			ads: input.ads
		})
		.returning();
	return row;
}

export async function getCurrentConsent(id: ConsentIdentity): Promise<ConsentRow | null> {
	const where = identityFilter(id);
	if (!where) return null;
	const [row] = await db
		.select()
		.from(consentRecord)
		.where(where)
		.orderBy(desc(consentRecord.acceptedAt))
		.limit(1);
	return row ?? null;
}

export async function listConsents(id: ConsentIdentity): Promise<ConsentRow[]> {
	const where = identityFilter(id);
	if (!where) return [];
	return db.select().from(consentRecord).where(where).orderBy(desc(consentRecord.acceptedAt));
}
