import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Page from './+page.svelte';

test('landing renders headline and three-step section', async () => {
	const screen = render(Page);
	await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();
	await expect.element(screen.getByText(/how it works/i)).toBeVisible();
});
