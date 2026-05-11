import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

const enabled = process.env.RUN_DOCKER_SMOKE === '1';

test.describe('@docker self-host smoke', () => {
	test.skip(!enabled, 'set RUN_DOCKER_SMOKE=1 to run');
	test.setTimeout(180_000);

	test.beforeAll(() => {
		execFileSync('docker', ['compose', 'up', '-d', '--build'], { stdio: 'inherit' });
	});

	test.afterAll(() => {
		execFileSync('docker', ['compose', 'down', '-v'], { stdio: 'inherit' });
	});

	test('healthz reachable after compose up', async () => {
		const deadline = Date.now() + 60_000;
		let lastStatus = 0;
		while (Date.now() < deadline) {
			try {
				const r = await fetch('http://localhost:3000/api/healthz');
				lastStatus = r.status;
				if (r.ok) return;
			} catch {
				// container not ready yet
			}
			await new Promise((res) => setTimeout(res, 2000));
		}
		expect(lastStatus, 'healthz never returned 200').toBe(200);
	});
});
