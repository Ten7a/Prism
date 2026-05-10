import { expect, test } from '@playwright/test';

const BANNER = '[data-testid="cookie-banner"]';

test.describe('cookie banner', () => {
	test('banner appears for new visitor and disappears after Accept all', async ({
		context,
		page
	}) => {
		await context.clearCookies();
		await page.goto('/');
		await expect(page.locator(BANNER)).toBeVisible();
		await page.getByRole('button', { name: /accept all/i }).click();
		await expect(page.locator(BANNER)).toBeHidden();
		await page.reload();
		await expect(page.locator(BANNER)).toBeHidden();
	});

	test('Customize → Necessary only does not load ads', async ({ context, page }) => {
		await context.clearCookies();
		await page.goto('/library');
		await page.getByRole('button', { name: /customize/i }).click();
		await page.getByRole('button', { name: /necessary only/i }).click();
		await expect(page.locator(BANNER)).toBeHidden();
		await expect(page.locator('script[src*="pagead2"]')).toHaveCount(0);
		await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
	});

	test('legal pages render markdown with version', async ({ page }) => {
		await page.goto('/legal/privacy');
		await expect(page.getByRole('heading', { name: /privacy policy/i })).toBeVisible();
		await expect(page.getByText(/version v1/i)).toBeVisible();

		await page.goto('/legal/terms');
		await expect(page.getByRole('heading', { name: /terms of service/i })).toBeVisible();
	});

	test('stale policy version re-triggers the banner', async ({ context, page }) => {
		const url = new URL('http://localhost:5173/');
		await context.addCookies([
			{
				name: 'prism_consent',
				value: encodeURIComponent('v0:n=1,a=0,ads=0'),
				domain: url.hostname,
				path: '/',
				sameSite: 'Lax'
			}
		]);
		await page.goto('/');
		await expect(page.locator(BANNER)).toBeVisible();
	});
});
