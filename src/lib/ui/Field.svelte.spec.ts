import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Field from './Field.svelte';

test('label is associated with input', async () => {
	const screen = render(Field, { props: { label: 'Email', name: 'email' } });
	await expect.element(screen.getByLabelText('Email')).toBeVisible();
});

test('aria-describedby is set when error provided', async () => {
	render(Field, { props: { label: 'Email', error: 'Required' } });
	const input = document.querySelector('input') as HTMLInputElement;
	expect(input.getAttribute('aria-describedby')).toBeTruthy();
	const describedById = input.getAttribute('aria-describedby')!;
	const errorEl = document.getElementById(describedById.split(' ').pop()!);
	expect(errorEl?.textContent).toBe('Required');
	expect(input.getAttribute('aria-invalid')).toBe('true');
});

test('renders textarea when as=textarea', async () => {
	render(Field, { props: { label: 'Bio', as: 'textarea' } });
	expect(document.querySelector('textarea')).not.toBeNull();
});
