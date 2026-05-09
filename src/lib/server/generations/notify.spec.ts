import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('./listen', () => ({
	pgSubscribe: vi.fn(),
	pgNotify: vi.fn().mockResolvedValue(undefined)
}));

import { _resetSubscribersForTests, publish, subscribe, type JobEvent } from './notify';

describe('notify (in-mem pub/sub)', () => {
	afterEach(() => {
		_resetSubscribersForTests();
	});

	test('subscribe receives published events', async () => {
		const events: JobEvent[] = [];
		const off = subscribe('job-1', (e) => events.push(e));

		await publish('job-1', { type: 'progress', i: 0, total: 2 });
		await publish('job-1', { type: 'done', costActual: 5 });

		expect(events).toEqual([
			{ type: 'progress', i: 0, total: 2 },
			{ type: 'done', costActual: 5 }
		]);
		off();
	});

	test('unsubscribe stops delivery', async () => {
		const events: JobEvent[] = [];
		const off = subscribe('job-2', (e) => events.push(e));
		off();
		await publish('job-2', { type: 'done', costActual: 1 });
		expect(events).toEqual([]);
	});

	test('multiple subscribers all receive', async () => {
		const a: JobEvent[] = [];
		const b: JobEvent[] = [];
		subscribe('job-3', (e) => a.push(e));
		subscribe('job-3', (e) => b.push(e));
		await publish('job-3', { type: 'done', costActual: 0 });
		expect(a).toHaveLength(1);
		expect(b).toHaveLength(1);
	});

	test('different jobs are isolated', async () => {
		const a: JobEvent[] = [];
		subscribe('job-A', (e) => a.push(e));
		await publish('job-B', { type: 'done', costActual: 0 });
		expect(a).toHaveLength(0);
	});
});
