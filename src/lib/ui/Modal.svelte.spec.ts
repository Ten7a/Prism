import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import Modal from './Modal.svelte';

const body = createRawSnippet(() => ({
	render: () => '<div><button>First</button><button>Last</button></div>'
}));

test('renders dialog with aria-modal when open', async () => {
	const screen = render(Modal, {
		props: { open: true, onClose: () => {}, children: body }
	});
	const dialog = screen.getByRole('dialog').element() as HTMLElement;
	expect(dialog.getAttribute('aria-modal')).toBe('true');
});

test('does not render when open=false', async () => {
	render(Modal, { props: { open: false, onClose: () => {}, children: body } });
	expect(document.querySelector('[role="dialog"]')).toBeNull();
});

test('ESC closes', async () => {
	const onClose = vi.fn();
	render(Modal, { props: { open: true, onClose, children: body } });
	document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
	await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('Tab from last focusable wraps to first', async () => {
	render(Modal, { props: { open: true, onClose: () => {}, children: body } });
	await vi.waitFor(() => {
		const buttons = document.querySelectorAll('[role="dialog"] button');
		expect(buttons.length).toBe(2);
	});
	const buttons = Array.from(
		document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')
	);
	const first = buttons[0];
	const last = buttons[buttons.length - 1];
	last.focus();
	expect(document.activeElement).toBe(last);
	const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
	document.dispatchEvent(ev);
	await vi.waitFor(() => expect(document.activeElement).toBe(first));
});
