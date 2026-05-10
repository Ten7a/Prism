import type { Limiter, LimiterResult } from './index';
import type { RateSpec } from './parse';

interface Bucket {
	tokens: number;
	lastMs: number;
}

export function createMemoryLimiter(): Limiter & { _reset(): void } {
	const buckets = new Map<string, Bucket>();

	return {
		async hit(key: string, opts: RateSpec): Promise<LimiterResult> {
			const now = Date.now();
			const existing = buckets.get(key);
			let tokens = existing ? existing.tokens : opts.capacity;
			const lastMs = existing ? existing.lastMs : now;
			if (existing) {
				const elapsedSec = Math.max(0, (now - lastMs) / 1000);
				tokens = Math.min(opts.capacity, tokens + elapsedSec * opts.refillPerSec);
			}
			if (tokens >= 1) {
				buckets.set(key, { tokens: tokens - 1, lastMs: now });
				return { allowed: true };
			}
			buckets.set(key, { tokens, lastMs: now });
			const needed = 1 - tokens;
			const retryAfterSec =
				opts.refillPerSec > 0 ? Math.max(1, Math.ceil(needed / opts.refillPerSec)) : 1;
			return { allowed: false, retryAfterSec };
		},
		_reset() {
			buckets.clear();
		}
	};
}
