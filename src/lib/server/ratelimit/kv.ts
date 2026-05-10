import type { Limiter, LimiterResult } from './index';
import type { RateSpec } from './parse';

interface Stored {
	tokens: number;
	lastMs: number;
}

export function createKvLimiter(kv: KVNamespace): Limiter {
	return {
		async hit(key: string, opts: RateSpec): Promise<LimiterResult> {
			const now = Date.now();
			const raw = await kv.get<Stored>(key, { type: 'json' });
			let tokens = raw ? raw.tokens : opts.capacity;
			if (raw) {
				const elapsedSec = Math.max(0, (now - raw.lastMs) / 1000);
				tokens = Math.min(opts.capacity, tokens + elapsedSec * opts.refillPerSec);
			}
			const ttl = Math.max(60, Math.ceil(opts.capacity / Math.max(opts.refillPerSec, 1e-6)));
			if (tokens >= 1) {
				const next: Stored = { tokens: tokens - 1, lastMs: now };
				await kv.put(key, JSON.stringify(next), { expirationTtl: ttl });
				return { allowed: true };
			}
			const next: Stored = { tokens, lastMs: now };
			await kv.put(key, JSON.stringify(next), { expirationTtl: ttl });
			const needed = 1 - tokens;
			const retryAfterSec =
				opts.refillPerSec > 0 ? Math.max(1, Math.ceil(needed / opts.refillPerSec)) : 1;
			return { allowed: false, retryAfterSec };
		}
	};
}
