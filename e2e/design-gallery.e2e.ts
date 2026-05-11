import { expect, test } from '@playwright/test';

test('design gallery is 404 in prod build', async ({ page }) => {
	const res = await page.goto('/design');
	expect(res?.status()).toBe(404);
});
