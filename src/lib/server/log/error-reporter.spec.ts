import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { SENTRY_DSN: '' } }));
import { env } from '$env/dynamic/private';
import { reportError } from './error-reporter';

describe('reportError', () => {
	beforeEach(() => {
		(env as Record<string, string | undefined>).SENTRY_DSN = '';
		vi.restoreAllMocks();
	});
	afterEach(() => {
		(env as Record<string, string | undefined>).SENTRY_DSN = '';
	});

	test('no-op without DSN', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
		await reportError(new Error('x'));
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	test('posts envelope to DSN ingest URL', async () => {
		(env as Record<string, string | undefined>).SENTRY_DSN =
			'https://abc123@o12345.ingest.sentry.io/67890';
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
		await reportError(new Error('boom'), { requestId: 'req-1' });
		expect(fetchSpy).toHaveBeenCalled();
		const [url, init] = fetchSpy.mock.calls[0];
		expect(String(url)).toContain('o12345.ingest.sentry.io');
		expect(String(url)).toContain('/api/67890/envelope/');
		expect(String(url)).toContain('sentry_key=abc123');
		const body = String((init as RequestInit).body);
		const lines = body.split('\n');
		expect(lines).toHaveLength(3);
		const payload = JSON.parse(lines[2]);
		expect(payload.exception.values[0].value).toBe('boom');
		expect(payload.tags.requestId).toBe('req-1');
	});

	test('swallows fetch errors silently', async () => {
		(env as Record<string, string | undefined>).SENTRY_DSN =
			'https://abc123@o12345.ingest.sentry.io/67890';
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
		await expect(reportError(new Error('x'))).resolves.toBeUndefined();
	});
});
