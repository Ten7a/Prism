import { describe, expect, test, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: false }));

describe('/design page server load', () => {
	test('throws 404 when not in dev', async () => {
		const mod = await import('./+page.server');
		const load = mod.load as unknown as () => unknown;
		try {
			load();
			throw new Error('expected load to throw');
		} catch (e) {
			const err = e as { status?: number };
			expect(err.status).toBe(404);
		}
	});
});
