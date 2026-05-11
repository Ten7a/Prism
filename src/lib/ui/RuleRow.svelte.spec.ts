import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import RuleRow from './RuleRow.svelte';

const left = createRawSnippet(() => ({ render: () => '<span>Buy 1000</span>' }));
const center = createRawSnippet(() => ({ render: () => '<span>$10.00</span>' }));
const right = createRawSnippet(() => ({ render: () => '<span>checkout →</span>' }));

test('renders left/center/right slots', async () => {
	const screen = render(RuleRow, { props: { left, center, right, href: '/pricing' } });
	await expect.element(screen.getByText('Buy 1000')).toBeVisible();
	await expect.element(screen.getByText('$10.00')).toBeVisible();
	await expect.element(screen.getByText('checkout →')).toBeVisible();
});

test('renders as anchor when href provided', async () => {
	const screen = render(RuleRow, { props: { left, href: '/pricing' } });
	const el = screen.getByText('Buy 1000').element() as HTMLElement;
	const link = el.closest('a');
	expect(link).not.toBeNull();
	expect(link?.getAttribute('href')).toBe('/pricing');
});

test('renders as div when no href', async () => {
	render(RuleRow, { props: { left } });
	expect(document.querySelector('div.row')).not.toBeNull();
});
