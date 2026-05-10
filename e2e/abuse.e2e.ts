import { expect, test } from '@playwright/test';

// Anonymous flooding the API hits the per-IP limiter in hooks.server.ts and
// should receive at least one 429 with a Retry-After header well before the
// per-minute cap is exceeded by 100 requests.
test('flooding /api/generations as anon eventually returns 429', async ({ request }) => {
	let rateLimited = 0;
	let retryAfter: string | null = null;
	for (let i = 0; i < 100; i++) {
		const r = await request.post('/api/generations', {
			data: { model: 'x', prompt: 'x', ratio: '1:1', quality: '1k' },
			failOnStatusCode: false
		});
		if (r.status() === 429) {
			rateLimited++;
			retryAfter ??= r.headers()['retry-after'] ?? null;
		}
	}
	expect(rateLimited).toBeGreaterThan(0);
	expect(retryAfter).not.toBeNull();
});
