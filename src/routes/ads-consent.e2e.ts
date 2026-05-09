import { expect, test } from '@playwright/test';

const PAGEAD = 'script[src*="pagead2"]';
const CONSENT_ON = 'v1:n=1,a=0,ads=1';

test.describe('ads — consent gating', () => {
	test('AdSense script absent on /library without consent', async ({ page }) => {
		await page.goto('/library', { waitUntil: 'networkidle' });
		await expect(page.locator(PAGEAD)).toHaveCount(0);
		await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
	});

	test('AdSense script absent on / landing without consent', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });
		await expect(page.locator(PAGEAD)).toHaveCount(0);
	});

	test('AdSense loads on /library when prism_consent cookie has ads=1', async ({
		context,
		page
	}) => {
		const url = new URL(page.url() === 'about:blank' ? 'http://localhost:5173' : page.url());
		await context.addCookies([
			{
				name: 'prism_consent',
				value: encodeURIComponent(CONSENT_ON),
				domain: url.hostname,
				path: '/',
				httpOnly: false,
				sameSite: 'Lax'
			}
		]);
		await page.goto('/library');
		await expect(page.locator('ins.adsbygoogle')).toHaveCount(1);
		await expect(page.locator(PAGEAD)).toHaveCount(1);
	});

	test.skip('clicking the consent banner unlocks ads', () => {
		// The "Accept all" banner ships in plan/10-consent-banner; this contract is
		// already covered structurally by the cookie-based test above.
	});
});
