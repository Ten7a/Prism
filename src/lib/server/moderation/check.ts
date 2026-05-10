import { env } from '$env/dynamic/private';
import { OpenRouterError, orFetch } from '../openrouter/client';
import { baseLog } from '../log';

const log = baseLog.child({ mod: 'moderation' });

export interface ModerationResult {
	flagged: boolean;
	categories: string[];
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const CACHE_MAX = 1000;
const cache = new Map<string, { result: ModerationResult; expiresAt: number }>();

async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input.normalize('NFKC').toLowerCase().trim());
	const buf = await crypto.subtle.digest('SHA-256', data);
	const bytes = new Uint8Array(buf);
	let out = '';
	for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
	return out;
}

function cachePut(key: string, result: ModerationResult): void {
	if (cache.size >= CACHE_MAX) {
		const first = cache.keys().next().value;
		if (first !== undefined) cache.delete(first);
	}
	cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

function cacheGet(key: string): ModerationResult | null {
	const hit = cache.get(key);
	if (!hit) return null;
	if (hit.expiresAt < Date.now()) {
		cache.delete(key);
		return null;
	}
	return hit.result;
}

interface ModerationsApiResponse {
	results?: Array<{
		flagged?: boolean;
		categories?: Record<string, boolean> | string[];
	}>;
	flagged?: boolean;
	categories?: Record<string, boolean> | string[];
}

function extractCategories(c: Record<string, boolean> | string[] | undefined): string[] {
	if (!c) return [];
	if (Array.isArray(c)) return c;
	return Object.entries(c)
		.filter(([, v]) => v === true)
		.map(([k]) => k);
}

async function callModerationsApi(model: string, prompt: string): Promise<ModerationResult | null> {
	try {
		const res = await orFetch('/moderations', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ input: prompt, model })
		});
		const data = (await res.json()) as ModerationsApiResponse;
		const r0 = data.results?.[0];
		if (r0) {
			return { flagged: !!r0.flagged, categories: extractCategories(r0.categories) };
		}
		if (typeof data.flagged === 'boolean') {
			return { flagged: data.flagged, categories: extractCategories(data.categories) };
		}
		return { flagged: false, categories: [] };
	} catch (err) {
		if (err instanceof OpenRouterError && err.status === 404) return null;
		throw err;
	}
}

interface ChatCompletionResponse {
	choices?: Array<{ message?: { content?: string } }>;
}

async function callChatModeration(model: string, prompt: string): Promise<ModerationResult> {
	const system = `You are a strict content-policy moderator. Reply ONLY with compact JSON of the shape {"flagged":boolean,"categories":string[]}. Categories include sexual_minors, violence, hate, self_harm, sexual, illicit. Flag any policy violation.`;
	const res = await orFetch('/chat/completions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: prompt }
			],
			temperature: 0,
			response_format: { type: 'json_object' }
		})
	});
	const data = (await res.json()) as ChatCompletionResponse;
	const content = data.choices?.[0]?.message?.content ?? '{}';
	try {
		const parsed = JSON.parse(content) as { flagged?: boolean; categories?: string[] };
		return {
			flagged: !!parsed.flagged,
			categories: Array.isArray(parsed.categories) ? parsed.categories : []
		};
	} catch {
		return { flagged: false, categories: [] };
	}
}

export async function checkPrompt(prompt: string): Promise<ModerationResult> {
	const model = env.MODERATION_MODEL?.trim();
	if (!model) return { flagged: false, categories: [] };

	const key = await sha256Hex(prompt);
	const cached = cacheGet(key);
	if (cached) return cached;

	let result: ModerationResult;
	try {
		const direct = await callModerationsApi(model, prompt);
		result = direct ?? (await callChatModeration(model, prompt));
	} catch (err) {
		log.warn({ err: (err as Error).message }, 'check failed, allowing prompt');
		return { flagged: false, categories: [] };
	}
	cachePut(key, result);
	return result;
}

export function _resetModerationCacheForTests(): void {
	cache.clear();
}
