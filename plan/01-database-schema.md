# 01 — Database schema

## Goal

Add the domain tables Prism needs (token ledger, generation jobs, images, packs, consent) on top of the existing Better Auth tables, and prove the integrity rules with tests.

## Touches

- `src/lib/server/db/schema.ts` — extend with new tables; remove the demo `task` table.
- `src/lib/server/db/queries/balance.ts` — `getBalance(userId)` helper.
- `src/lib/server/db/queries/jobs.ts` — `createJob`, `finishJob`, `failJob`.
- `drizzle/` (generated) — new migration file.
- `.env.example` — already has `DATABASE_URL`; no change.

## Reuses

- Existing [`src/lib/server/db/index.ts`](../src/lib/server/db/index.ts) (postgres-js client).
- Existing auth tables via the `* from './auth.schema'` re-export in [`schema.ts`](../src/lib/server/db/schema.ts).
- Drizzle migration pipeline already wired in [`package.json`](../package.json) (`db:generate`, `db:migrate`).

## Schema

```ts
// src/lib/server/db/schema.ts
import {
	pgTable,
	uuid,
	text,
	integer,
	bigint,
	timestamp,
	jsonb,
	pgEnum,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

export const jobStatus = pgEnum('job_status', [
	'queued',
	'running',
	'succeeded',
	'failed',
	'cancelled'
]);

export const ledgerReason = pgEnum('ledger_reason', [
	'daily_grant',
	'pack_purchase',
	'generation_debit',
	'generation_refund',
	'admin_adjustment'
]);

export const tokenLedger = pgTable(
	'token_ledger',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		delta: integer('delta').notNull(), // signed
		reason: ledgerReason('reason').notNull(),
		jobId: uuid('job_id'), // soft FK to generationJob
		stripeEventId: text('stripe_event_id'), // idempotency key for webhooks
		dailyGrantDay: text('daily_grant_day'), // 'YYYY-MM-DD' UTC, for unique idx
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => ({
		userIdx: index().on(t.userId, t.createdAt),
		uniqDailyGrant: uniqueIndex('uniq_daily_grant')
			.on(t.userId, t.dailyGrantDay)
			.where(sql`${t.reason} = 'daily_grant'`),
		uniqStripeEvent: uniqueIndex('uniq_stripe_event').on(t.stripeEventId)
	})
);

export const generationJob = pgTable(
	'generation_job',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		modelId: text('model_id').notNull(),
		prompt: text('prompt').notNull(),
		refImageKeys: jsonb('ref_image_keys').$type<string[]>().default([]).notNull(),
		ratio: text('ratio').notNull(), // '1:1' | '16:9' | ...
		quality: text('quality').notNull(), // '1k' | '2k' | '4k'
		batch: integer('batch').notNull().default(1),
		status: jobStatus('status').notNull().default('queued'),
		costEstimate: integer('cost_estimate').notNull(), // tokens debited at start
		costActual: integer('cost_actual'), // tokens after success
		errorCode: text('error_code'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		finishedAt: timestamp('finished_at', { withTimezone: true })
	},
	(t) => ({ userCreated: index().on(t.userId, t.createdAt.desc()) })
);

export const image = pgTable(
	'image',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		jobId: uuid('job_id')
			.notNull()
			.references(() => generationJob.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		r2Key: text('r2_key').notNull(),
		width: integer('width').notNull(),
		height: integer('height').notNull(),
		mime: text('mime').notNull(),
		bytes: bigint('bytes', { mode: 'number' }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => ({ userCreated: index().on(t.userId, t.createdAt.desc()) })
);

export const tokenPack = pgTable('token_pack', {
	id: uuid('id').defaultRandom().primaryKey(),
	slug: text('slug').notNull().unique(), // 'starter', 'pro', ...
	name: text('name').notNull(),
	tokens: integer('tokens').notNull(),
	priceCents: integer('price_cents').notNull(),
	stripePriceId: text('stripe_price_id').notNull().unique(),
	active: boolean('active').notNull().default(true)
});

export const consentRecord = pgTable(
	'consent_record',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }), // nullable for anon
		anonId: text('anon_id'), // cookie id for pre-auth
		version: text('version').notNull(), // policy version
		necessary: boolean('necessary').notNull().default(true),
		analytics: boolean('analytics').notNull().default(false),
		ads: boolean('ads').notNull().default(false),
		acceptedAt: timestamp('accepted_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => ({ userIdx: index().on(t.userId), anonIdx: index().on(t.anonId) })
);

export * from './auth.schema';
```

> Note: the demo `task` table is removed in this step.

## Steps

1. Edit [`schema.ts`](../src/lib/server/db/schema.ts) — replace `task` with the schema above.
2. Run `npm run db:generate` — produces a new migration in `drizzle/`.
3. Inspect the generated SQL; manually verify the `uniq_daily_grant` partial unique index.
4. Run `npm run db:migrate` against a local Postgres (Docker `postgres:17`).
5. Implement query helpers:
   - `getBalance(userId): Promise<number>` — `SUM(delta)` aggregate.
   - `createJob(input): Promise<GenerationJob>` — inside a Drizzle transaction: insert ledger debit + insert job.
   - `finishJob(jobId, images, costActual)` / `failJob(jobId, code)` — update job, insert refund row when needed.

## Tests

`src/lib/server/db/queries/balance.spec.ts` (vitest, real Postgres via test container or local `DATABASE_URL_TEST`):

```ts
test('balance equals signed sum of ledger deltas', async () => {
	const u = await seedUser();
	await insertLedger(u.id, +10, 'daily_grant', { day: '2026-05-09' });
	await insertLedger(u.id, +100, 'pack_purchase', { stripeEventId: 'evt_1' });
	await insertLedger(u.id, -8, 'generation_debit');
	expect(await getBalance(u.id)).toBe(102);
});

test('daily_grant insert is idempotent per UTC day', async () => {
	const u = await seedUser();
	await insertLedger(u.id, +10, 'daily_grant', { day: '2026-05-09' });
	await expect(insertLedger(u.id, +10, 'daily_grant', { day: '2026-05-09' })).rejects.toThrow();
});

test('stripe webhook idempotency: same event credits once', async () => {
	const u = await seedUser();
	await insertLedger(u.id, +100, 'pack_purchase', { stripeEventId: 'evt_42' });
	await expect(
		insertLedger(u.id, +100, 'pack_purchase', { stripeEventId: 'evt_42' })
	).rejects.toThrow();
});
```

`src/lib/server/db/queries/jobs.spec.ts`:

```ts
test('createJob debits and links ledger row to job atomically', async () => {
	const u = await seedUser();
	await insertLedger(u.id, +50, 'pack_purchase', { stripeEventId: 'evt_seed' });
	const job = await createJob({ userId: u.id, prompt: 'cat', costEstimate: 5 /* … */ });
	expect(await getBalance(u.id)).toBe(45);
	expect(job.status).toBe('queued');
});

test('failJob refunds the estimate', async () => {
	// … debit 5, fail, balance returns to original
});
```

E2E: not yet — covered when the API endpoints land in step 05.

## Verify

```bash
npm run db:generate
npm run db:migrate
npm run check
npm run test:unit -- --run src/lib/server/db
```

Acceptance: schema compiles, migrations apply cleanly, all ledger invariants hold under tests, and the demo `task` table is gone.
