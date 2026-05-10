import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

process.env.OPENROUTER_API_KEY = 'or_test_dummy';
process.env.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1';
process.env.MODERATION_MODEL = 'omni-moderation-latest';

vi.mock('$env/dynamic/private', () => ({ env: process.env }));

import { _resetModerationCacheForTests, checkPrompt } from './check';

let modCalls = 0;
const server = setupServer(
	http.post('https://openrouter.test/api/v1/moderations', async () => {
		modCalls++;
		return HttpResponse.json({
			results: [{ flagged: false, categories: { violence: false, sexual: false } }]
		});
	})
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterAll(() => server.close());
beforeEach(() => {
	modCalls = 0;
	_resetModerationCacheForTests();
	server.resetHandlers(
		http.post('https://openrouter.test/api/v1/moderations', async () => {
			modCalls++;
			return HttpResponse.json({
				results: [{ flagged: false, categories: { violence: false, sexual: false } }]
			});
		})
	);
});
afterEach(() => server.resetHandlers());

describe('checkPrompt', () => {
	test('returns flagged=false for benign prompt', async () => {
		const r = await checkPrompt('a cat');
		expect(r.flagged).toBe(false);
		expect(modCalls).toBe(1);
	});

	test('caches by prompt hash (no second network call)', async () => {
		await checkPrompt('a cat');
		await checkPrompt('a cat');
		expect(modCalls).toBe(1);
	});

	test('normalises prompt before hashing (case + whitespace)', async () => {
		await checkPrompt('A Cat');
		await checkPrompt('  a cat  ');
		expect(modCalls).toBe(1);
	});

	test('returns flagged=true with categories on violation', async () => {
		_resetModerationCacheForTests();
		server.use(
			http.post('https://openrouter.test/api/v1/moderations', () =>
				HttpResponse.json({
					results: [{ flagged: true, categories: { violence: true, hate: false } }]
				})
			)
		);
		const r = await checkPrompt('xx');
		expect(r.flagged).toBe(true);
		expect(r.categories).toContain('violence');
	});

	test('falls back to chat-completions on /moderations 404', async () => {
		_resetModerationCacheForTests();
		let chatCalls = 0;
		server.use(
			http.post('https://openrouter.test/api/v1/moderations', () =>
				HttpResponse.text('not found', { status: 404 })
			),
			http.post('https://openrouter.test/api/v1/chat/completions', () => {
				chatCalls++;
				return HttpResponse.json({
					choices: [{ message: { content: '{"flagged":true,"categories":["violence"]}' } }]
				});
			})
		);
		const r = await checkPrompt('chat-fallback prompt');
		expect(chatCalls).toBe(1);
		expect(r.flagged).toBe(true);
		expect(r.categories).toEqual(['violence']);
	});

	test('opens (allows) when MODERATION_MODEL is empty', async () => {
		const prev = process.env.MODERATION_MODEL;
		process.env.MODERATION_MODEL = '';
		_resetModerationCacheForTests();
		const r = await checkPrompt('anything');
		expect(r.flagged).toBe(false);
		expect(modCalls).toBe(0);
		process.env.MODERATION_MODEL = prev;
	});

	test('fails open on network/upstream error', async () => {
		_resetModerationCacheForTests();
		server.use(
			http.post('https://openrouter.test/api/v1/moderations', () =>
				HttpResponse.text('boom', { status: 500 })
			)
		);
		const r = await checkPrompt('upstream-broken prompt');
		expect(r.flagged).toBe(false);
	});
});
