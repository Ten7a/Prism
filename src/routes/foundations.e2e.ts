import { expect, test } from '@playwright/test';

test('header exposes top-level nav links', async ({ page }) => {
	await page.goto('/');
	const nav = page.getByRole('navigation');
	await expect(nav.getByRole('link', { name: 'Generate', exact: true })).toBeVisible();
	await expect(nav.getByRole('link', { name: 'Library', exact: true })).toBeVisible();
	await expect(nav.getByRole('link', { name: 'Account', exact: true })).toBeVisible();
});

test('layout renders scanlines overlay', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.scanlines')).toHaveCount(1);
});

test('demo routes are gone', async ({ page }) => {
	const response = await page.goto('/demo');
	expect(response?.status()).toBe(404);
});
