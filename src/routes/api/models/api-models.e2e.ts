import { expect, test } from '@playwright/test';

test('GET /api/models returns a non-empty catalogue with pricing', async ({ request }) => {
	const res = await request.get('/api/models');
	expect(res.ok()).toBe(true);
	const body = await res.json();
	expect(Array.isArray(body.models)).toBe(true);
	expect(body.models.length).toBeGreaterThanOrEqual(5);

	for (const m of body.models) {
		expect(typeof m.id).toBe('string');
		expect(m.pricing).toBeTruthy();
		expect(typeof m.pricing.shape).toBe('string');
	}
});
