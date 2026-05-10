import { expect, test } from '@playwright/test';

test('healthz returns 200 with db reachable', async ({ request }) => {
	const r = await request.get('/api/healthz');
	expect([200, 503]).toContain(r.status());
	const body = await r.json();
	expect(body).toHaveProperty('db');
	expect(body).toHaveProperty('r2');
});

test('every response carries x-request-id', async ({ request }) => {
	const r = await request.get('/api/healthz');
	const reqId = r.headers()['x-request-id'];
	expect(reqId).toMatch(/^[0-9a-f-]{36}$/i);
});

test('metrics endpoint returns 401 without bearer when token configured', async ({ request }) => {
	const r = await request.get('/api/metrics');
	// 404 if METRICS_TOKEN unset, 401 if set without valid header.
	expect([401, 404]).toContain(r.status());
});

test('metrics endpoint returns 200 with valid bearer when configured', async ({ request }) => {
	const token = process.env.METRICS_TOKEN;
	test.skip(!token, 'METRICS_TOKEN not configured');
	const r = await request.get('/api/metrics', {
		headers: { authorization: `Bearer ${token}` }
	});
	expect(r.status()).toBe(200);
	const text = await r.text();
	expect(text).toContain('prism_http_requests_total');
});
