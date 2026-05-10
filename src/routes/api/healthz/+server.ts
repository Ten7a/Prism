import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { storage } from '$lib/server/storage';

const HEALTH_KEY = '_healthz/probe';

function sanitise(err: unknown): string {
	const msg = err instanceof Error ? err.message : String(err);
	return msg.split('\n')[0].replace(/https?:\/\/\S+/g, '<url>').slice(0, 200);
}

export const GET: RequestHandler = async ({ platform }) => {
	let dbStatus: 'ok' | 'fail' = 'ok';
	let r2Status: 'ok' | 'fail' = 'ok';
	let dbErr: string | undefined;
	let r2Err: string | undefined;

	try {
		await db.execute(sql`select 1`);
	} catch (err) {
		dbStatus = 'fail';
		dbErr = sanitise(err);
	}

	try {
		await storage(platform).head(HEALTH_KEY);
	} catch (err) {
		r2Status = 'fail';
		r2Err = sanitise(err);
	}

	const ok = dbStatus === 'ok' && r2Status === 'ok';
	const body = {
		ok,
		db: dbStatus,
		r2: r2Status,
		commit: env.GIT_SHA ?? null,
		...(dbErr ? { dbError: dbErr } : {}),
		...(r2Err ? { r2Error: r2Err } : {})
	};
	return json(body, { status: ok ? 200 : 503 });
};
