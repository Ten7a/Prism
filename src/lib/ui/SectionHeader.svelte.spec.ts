import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import SectionHeader from './SectionHeader.svelte';

test('renders title as heading', async () => {
	const screen = render(SectionHeader, { props: { title: 'Pricing' } });
	await expect.element(screen.getByRole('heading', { name: 'Pricing' })).toBeVisible();
});

test('renders caption when provided', async () => {
	const screen = render(SectionHeader, {
		props: { title: 'Pricing', caption: 'Tokens · packs' }
	});
	await expect.element(screen.getByText('Tokens · packs')).toBeVisible();
});

test('omits caption when not provided', async () => {
	render(SectionHeader, { props: { title: 'Bare' } });
	expect(document.querySelector('.sec-caption')).toBeNull();
});
