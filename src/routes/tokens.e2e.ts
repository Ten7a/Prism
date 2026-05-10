import { expect, test } from '@playwright/test';
import { readdir, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const OUTBOX = process.env.EMAIL_OUTBOX_DIR;

test.describe('tokens', () => {
	test('/pricing renders 4 packs with checkout CTAs', async ({ page }) => {
		await page.goto('/pricing');
		await expect(page.getByRole('link', { name: /buy 100/i })).toHaveAttribute(
			'href',
			/\/api\/billing\/checkout\?pack=starter/
		);
		await expect(page.getByRole('link', { name: /buy 250/i })).toHaveAttribute('href', /pack=pro/);
		await expect(page.getByRole('link', { name: /buy 600/i })).toHaveAttribute(
			'href',
			/pack=studio/
		);
		await expect(page.getByRole('link', { name: /buy 2000/i })).toHaveAttribute(
			'href',
			/pack=bulk/
		);
	});
});

test.describe('tokens — daily grant', () => {
	test.skip(!OUTBOX, 'EMAIL_OUTBOX_DIR not set; skipping');
	test.skip(!process.env.DATABASE_URL, 'DATABASE_URL not set; skipping');

	test.beforeEach(async () => {
		if (OUTBOX) {
			await rm(OUTBOX, { recursive: true, force: true });
			await mkdir(OUTBOX, { recursive: true });
		}
	});

	async function waitForVerifyEmail(email: string, timeoutMs = 5000): Promise<string> {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			const files = (await readdir(OUTBOX!)).filter((f) => f.includes(encodeURIComponent(email)));
			for (const f of files) {
				const body = JSON.parse(await readFile(join(OUTBOX!, f), 'utf-8'));
				const m = body.text.match(/https?:\/\/\S+/);
				if (m) return m[0];
			}
			await new Promise((r) => setTimeout(r, 100));
		}
		throw new Error(`No verify email arrived for ${email}`);
	}

	test('new user lands on /generate with daily allowance already granted', async ({ page }) => {
		const email = `tokens-${Date.now()}@prism.test`;
		const password = 'correct-horse-battery';

		await page.goto('/signup');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByRole('button', { name: 'Sign up' }).click();
		await expect(page.getByText(/account created/i)).toBeVisible();

		const url = await waitForVerifyEmail(email);
		await page.goto(url);

		await page.goto('/login');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL(/\/account/);

		await page.goto('/generate');
		await expect(page.getByTestId('balance')).toHaveText(/10/);
	});
});
