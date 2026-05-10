import { beforeEach, describe, expect, test } from 'vitest';
import { incCounter, observe, registry } from './metrics';

describe('metrics', () => {
	beforeEach(() => {
		registry.reset();
	});

	test('counter increments and labels render', () => {
		incCounter('prism_test_total', { route: '/x', status: 200 });
		incCounter('prism_test_total', { route: '/x', status: 200 });
		incCounter('prism_test_total', { route: '/y', status: 500 });
		const out = registry.renderProm();
		expect(out).toContain('# TYPE prism_test_total counter');
		expect(out).toMatch(/prism_test_total\{route="\/x",status="200"\} 2/);
		expect(out).toMatch(/prism_test_total\{route="\/y",status="500"\} 1/);
	});

	test('counter without labels', () => {
		incCounter('prism_simple_total', undefined, 5);
		expect(registry.renderProm()).toMatch(/prism_simple_total 5/);
	});

	test('histogram emits buckets, sum, count', () => {
		observe('prism_dur_seconds', 0.2);
		observe('prism_dur_seconds', 1.5);
		const out = registry.renderProm();
		expect(out).toContain('# TYPE prism_dur_seconds histogram');
		expect(out).toMatch(/prism_dur_seconds_count\{?\}? 2/);
		expect(out).toMatch(/prism_dur_seconds_sum\{?\}? 1\.7/);
		expect(out).toMatch(/le="\+Inf"/);
	});
});
