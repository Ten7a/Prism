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
	uniqueIndex,
	boolean
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
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
		delta: integer('delta').notNull(),
		reason: ledgerReason('reason').notNull(),
		jobId: uuid('job_id'),
		stripeEventId: text('stripe_event_id'),
		dailyGrantDay: text('daily_grant_day'),
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
		ratio: text('ratio').notNull(),
		quality: text('quality').notNull(),
		batch: integer('batch').notNull().default(1),
		status: jobStatus('status').notNull().default('queued'),
		costEstimate: integer('cost_estimate').notNull(),
		costActual: integer('cost_actual'),
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
	slug: text('slug').notNull().unique(),
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
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		anonId: text('anon_id'),
		version: text('version').notNull(),
		necessary: boolean('necessary').notNull().default(true),
		analytics: boolean('analytics').notNull().default(false),
		ads: boolean('ads').notNull().default(false),
		acceptedAt: timestamp('accepted_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => ({ userIdx: index().on(t.userId), anonIdx: index().on(t.anonId) })
);

export * from './auth.schema';
