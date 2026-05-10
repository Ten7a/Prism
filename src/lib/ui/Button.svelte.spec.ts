import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import Button from './Button.svelte';

const label = createRawSnippet(() => ({ render: () => '<span>Go</span>' }));

test('primary renders with role=button and announces label', async () => {
	const screen = render(Button, { props: { children: label, variant: 'primary' } });
	await expect.element(screen.getByRole('button', { name: 'Go' })).toBeVisible();
});

test('disabled prevents click event', async () => {
	let clicked = 0;
	const screen = render(Button, {
		props: { children: label, disabled: true, onclick: () => clicked++ }
	});
	const btn = screen.getByRole('button');
	const el = btn.element() as HTMLButtonElement;
	expect(el.disabled).toBe(true);
	el.click();
	expect(clicked).toBe(0);
});

test('ghost variant applies ghost class', async () => {
	const screen = render(Button, { props: { children: label, variant: 'ghost' } });
	const el = screen.getByRole('button').element() as HTMLButtonElement;
	expect(el.className).toContain('ghost');
});
