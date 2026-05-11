import type { RateSpec } from './parse';
import { createMemoryLimiter } from './memory';
import { createKvLimiter } from './kv';

export type { RateSpec } from './parse';
export { parseRateSpec } from './parse';

export interface LimiterResult {
	allowed: boolean;
	retryAfterSec?: number;
}

export interface Limiter {
	hit(key: string, opts: RateSpec): Promise<LimiterResult>;
}

let memoryFallback: Limiter | null = null;

export function getLimiter(platform?: App.Platform): Limiter {
	const kv = platform?.env?.RATE_LIMIT;
	if (kv) return createKvLimiter(kv);
	if (!memoryFallback) memoryFallback = createMemoryLimiter();
	return memoryFallback;
}

export function _resetLimiterForTests(): void {
	memoryFallback = null;
}
