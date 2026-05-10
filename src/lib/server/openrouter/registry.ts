import { orFetch } from './client';
import { normalise } from './pricing';
import { fallbackModels } from './static-fallback';
import type { ModelEntry } from './types';
import { baseLog } from '$lib/server/log';

const log = baseLog.child({ mod: 'openrouter' });

const CACHE_KEY = 'openrouter:models:v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
	models: ModelEntry[];
	storedAt: number;
}

let memCache: CacheEntry | null = null;

interface KVLike {
	get(key: string, opts?: { type?: 'json' | 'text' }): Promise<string | object | null>;
	put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface PlatformLike {
	env?: { MODEL_CACHE?: KVLike };
}

function fresh(entry: CacheEntry | null): boolean {
	return !!entry && Date.now() - entry.storedAt < CACHE_TTL_MS;
}

async function readKV(kv: KVLike | undefined): Promise<CacheEntry | null> {
	if (!kv) return null;
	try {
		const raw = await kv.get(CACHE_KEY, { type: 'json' });
		if (!raw || typeof raw !== 'object') return null;
		const entry = raw as CacheEntry;
		return fresh(entry) ? entry : null;
	} catch {
		return null;
	}
}

async function writeKV(kv: KVLike | undefined, entry: CacheEntry): Promise<void> {
	if (!kv) return;
	try {
		await kv.put(CACHE_KEY, JSON.stringify(entry), { expirationTtl: CACHE_TTL_MS / 1000 });
	} catch {
		// Best effort.
	}
}

export async function loadModels(platform?: PlatformLike): Promise<ModelEntry[]> {
	const kv = platform?.env?.MODEL_CACHE;

	if (fresh(memCache)) return memCache!.models;

	const fromKV = await readKV(kv);
	if (fromKV) {
		memCache = fromKV;
		return fromKV.models;
	}

	try {
		const res = await orFetch('/models?output_modalities=image');
		const body = (await res.json()) as { data?: unknown[] };
		const list = Array.isArray(body.data) ? body.data : [];
		const models = list
			.map((raw) => {
				try {
					return normalise(raw as Parameters<typeof normalise>[0]);
				} catch {
					return null;
				}
			})
			.filter((m): m is ModelEntry => m !== null);

		if (models.length === 0) throw new Error('OpenRouter returned no image models');

		const entry: CacheEntry = { models, storedAt: Date.now() };
		memCache = entry;
		await writeKV(kv, entry);
		return models;
	} catch (err) {
		log.warn({ err: (err as Error).message }, 'loadModels falling back to snapshot');
		return fallbackModels;
	}
}

export async function getModel(
	id: string,
	platform?: PlatformLike
): Promise<ModelEntry | null> {
	const all = await loadModels(platform);
	return all.find((m) => m.id === id) ?? null;
}

export function _resetCacheForTests(): void {
	memCache = null;
}
