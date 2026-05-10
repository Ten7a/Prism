import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import Chip from './Chip.svelte';

test('renders chip text', async () => {
	const children = createRawSnippet(() => ({ render: () => '<span>1k</span>' }));
	const screen = render(Chip, { props: { children } });
	await expect.element(screen.getByText('1k')).toBeVisible();
});

test('uses chip utility class', async () => {
	const children = createRawSnippet(() => ({ render: () => '<span>tag</span>' }));
	render(Chip, { props: { children } });
	const el = document.querySelector('span.chip') as HTMLElement;
	expect(el).not.toBeNull();
});
