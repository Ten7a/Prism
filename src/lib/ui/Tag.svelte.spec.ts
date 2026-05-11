import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import Tag from './Tag.svelte';

test('renders tag text', async () => {
	const children = createRawSnippet(() => ({ render: () => '<span>/ pricing</span>' }));
	const screen = render(Tag, { props: { children } });
	await expect.element(screen.getByText('/ pricing')).toBeVisible();
});

test('uses tag utility class', async () => {
	const children = createRawSnippet(() => ({ render: () => '<span>label</span>' }));
	render(Tag, { props: { children } });
	const el = document.querySelector('span.tag') as HTMLElement;
	expect(el).not.toBeNull();
});
