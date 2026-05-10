import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Spinner from './Spinner.svelte';

test('renders status role with default label', async () => {
	const screen = render(Spinner);
	const el = screen.getByRole('status').element() as HTMLElement;
	expect(el.getAttribute('aria-label')).toBe('Loading');
});

test('uses custom label', async () => {
	const screen = render(Spinner, { props: { label: 'Generating' } });
	const el = screen.getByRole('status').element() as HTMLElement;
	expect(el.getAttribute('aria-label')).toBe('Generating');
});

test('renders three dots', async () => {
	render(Spinner);
	expect(document.querySelectorAll('.dot').length).toBe(3);
});
