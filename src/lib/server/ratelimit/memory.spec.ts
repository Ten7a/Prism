import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryLimiter } from './memory';

describe('memory limiter', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
	});
	afterEach(() => vi.useRealTimers());

	test('allows up to capacity, then denies', async () => {
		const l = createMemoryLimiter();
		for (let i = 0; i < 5; i++) {
			expect((await l.hit('k', { capacity: 5, refillPerSec: 0 })).allowed).toBe(true);
		}
		const denied = await l.hit('k', { capacity: 5, refillPerSec: 0 });
		expect(denied.allowed).toBe(false);
		expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
	});

	test('refills over time', async () => {
		const l = createMemoryLimiter();
		for (let i = 0; i < 5; i++) await l.hit('k', { capacity: 5, refillPerSec: 5 });
		expect((await l.hit('k', { capacity: 5, refillPerSec: 5 })).allowed).toBe(false);
		vi.advanceTimersByTime(1000);
		expect((await l.hit('k', { capacity: 5, refillPerSec: 5 })).allowed).toBe(true);
	});

	test('isolates buckets per key', async () => {
		const l = createMemoryLimiter();
		await l.hit('a', { capacity: 1, refillPerSec: 0 });
		expect((await l.hit('a', { capacity: 1, refillPerSec: 0 })).allowed).toBe(false);
		expect((await l.hit('b', { capacity: 1, refillPerSec: 0 })).allowed).toBe(true);
	});

	test('Retry-After scales with deficit', async () => {
		const l = createMemoryLimiter();
		await l.hit('k', { capacity: 1, refillPerSec: 0.1 });
		const denied = await l.hit('k', { capacity: 1, refillPerSec: 0.1 });
		expect(denied.allowed).toBe(false);
		expect(denied.retryAfterSec).toBe(10); // 1 / 0.1
	});
});
