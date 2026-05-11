import { render } from 'vitest-browser-svelte';
import { afterEach, expect, test, vi } from 'vitest';
import Toast from './Toast.svelte';
import { push, clear, dismiss } from '$lib/stores/toast';

afterEach(() => clear());

test('renders pushed toast', async () => {
	render(Toast);
	push('Saved.');
	await vi.waitFor(() => {
		const el = document.querySelector('button.toast');
		expect(el?.textContent?.trim()).toBe('Saved.');
	});
});

test('dismiss removes toast', async () => {
	render(Toast);
	const id = push('Temp');
	await vi.waitFor(() => expect(document.querySelector('button.toast')).not.toBeNull());
	dismiss(id);
	await vi.waitFor(() => expect(document.querySelector('button.toast')).toBeNull());
});

test('region has aria-live=polite', async () => {
	render(Toast);
	const region = document.querySelector('[role="region"]');
	expect(region?.getAttribute('aria-live')).toBe('polite');
});
