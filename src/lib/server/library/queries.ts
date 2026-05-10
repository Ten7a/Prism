import { error } from '@sveltejs/kit';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { generationJob, image } from '$lib/server/db/schema';
import { storage } from '$lib/server/storage';
import { baseLog } from '$lib/server/log';

const log = baseLog.child({ mod: 'library' });

export interface LibraryItem {
	id: string;
	jobId: string;
	r2Key: string;
	width: number;
	height: number;
	mime: string;
	bytes: number;
	createdAt: Date;
	prompt: string;
	modelId: string;
	ratio: string;
	quality: string;
	batchIndex: number;
}

export interface ListResult {
	items: LibraryItem[];
	nextCursor: string | null;
}

interface DecodedCursor {
	c: string;
	i: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(item: { createdAt: Date; id: string }): string {
	const payload: DecodedCursor = { c: item.createdAt.toISOString(), i: item.id };
	return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(s: string): DecodedCursor {
	try {
		const json = Buffer.from(s, 'base64url').toString('utf8');
		const obj = JSON.parse(json) as DecodedCursor;
		if (typeof obj.c !== 'string' || typeof obj.i !== 'string' || !UUID_RE.test(obj.i)) {
			throw new Error('bad shape');
		}
		if (Number.isNaN(Date.parse(obj.c))) throw new Error('bad date');
		return obj;
	} catch {
		throw error(400, 'invalid cursor');
	}
}

function batchIndexFromKey(r2Key: string): number {
	// images/{userId}/{jobId}/{idx}.{ext}
	const m = r2Key.match(/\/(\d+)\.[^/]+$/);
	if (!m) return 0;
	const n = Number(m[1]);
	return Number.isInteger(n) && n >= 0 ? n : 0;
}

function rowToItem(row: {
	id: string;
	jobId: string;
	r2Key: string;
	width: number;
	height: number;
	mime: string;
	bytes: number;
	createdAt: Date;
	prompt: string;
	modelId: string;
	ratio: string;
	quality: string;
}): LibraryItem {
	return {
		id: row.id,
		jobId: row.jobId,
		r2Key: row.r2Key,
		width: row.width,
		height: row.height,
		mime: row.mime,
		bytes: row.bytes,
		createdAt: row.createdAt,
		prompt: row.prompt,
		modelId: row.modelId,
		ratio: row.ratio,
		quality: row.quality,
		batchIndex: batchIndexFromKey(row.r2Key)
	};
}

export async function listImages(
	userId: string,
	opts: { cursor?: string; limit?: number } = {}
): Promise<ListResult> {
	const limit = opts.limit ?? 24;
	const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;

	const where = cursor
		? and(
				eq(image.userId, userId),
				sql`(${image.createdAt}, ${image.id}) < (${cursor.c}::timestamptz, ${cursor.i}::uuid)`
			)
		: eq(image.userId, userId);

	const rows = await db
		.select({
			id: image.id,
			jobId: image.jobId,
			r2Key: image.r2Key,
			width: image.width,
			height: image.height,
			mime: image.mime,
			bytes: image.bytes,
			createdAt: image.createdAt,
			prompt: generationJob.prompt,
			modelId: generationJob.modelId,
			ratio: generationJob.ratio,
			quality: generationJob.quality
		})
		.from(image)
		.innerJoin(generationJob, eq(image.jobId, generationJob.id))
		.where(where)
		.orderBy(desc(image.createdAt), desc(image.id))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const kept = hasMore ? rows.slice(0, limit) : rows;
	const items = kept.map(rowToItem);
	const last = items[items.length - 1];
	const nextCursor = hasMore && last ? encodeCursor(last) : null;

	return { items, nextCursor };
}

export async function getImage(userId: string, id: string): Promise<LibraryItem> {
	if (!UUID_RE.test(id)) throw error(404, 'not found');
	const [row] = await db
		.select({
			id: image.id,
			jobId: image.jobId,
			userId: image.userId,
			r2Key: image.r2Key,
			width: image.width,
			height: image.height,
			mime: image.mime,
			bytes: image.bytes,
			createdAt: image.createdAt,
			prompt: generationJob.prompt,
			modelId: generationJob.modelId,
			ratio: generationJob.ratio,
			quality: generationJob.quality
		})
		.from(image)
		.innerJoin(generationJob, eq(image.jobId, generationJob.id))
		.where(eq(image.id, id))
		.limit(1);

	if (!row || row.userId !== userId) throw error(404, 'not found');
	return rowToItem(row);
}

export async function deleteImage(
	userId: string,
	id: string,
	platform?: App.Platform
): Promise<void> {
	if (!UUID_RE.test(id)) throw error(404, 'not found');
	const [row] = await db
		.select({ id: image.id, userId: image.userId, r2Key: image.r2Key })
		.from(image)
		.where(eq(image.id, id))
		.limit(1);

	if (!row || row.userId !== userId) throw error(404, 'not found');

	try {
		await storage(platform).delete([row.r2Key]);
	} catch (err) {
		log.warn({ r2Key: row.r2Key, err: (err as Error).message }, 'orphan key');
	}

	await db.delete(image).where(eq(image.id, id));
}
