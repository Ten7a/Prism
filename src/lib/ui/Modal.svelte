<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onDestroy, tick } from 'svelte';

	type Props = {
		open: boolean;
		onClose: () => void;
		labelledBy?: string;
		children: Snippet;
	};

	let { open, onClose, labelledBy, children }: Props = $props();

	let dialog = $state<HTMLDivElement | null>(null);
	let previouslyFocused: HTMLElement | null = null;

	const FOCUSABLE =
		'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

	function focusables(): HTMLElement[] {
		if (!dialog) return [];
		return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
			return;
		}
		if (e.key === 'Tab') {
			const els = focusables();
			if (els.length === 0) {
				e.preventDefault();
				return;
			}
			const first = els[0];
			const last = els[els.length - 1];
			const active = document.activeElement as HTMLElement | null;
			if (e.shiftKey && active === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && active === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	$effect(() => {
		if (open) {
			previouslyFocused = document.activeElement as HTMLElement | null;
			void tick().then(() => {
				const els = focusables();
				if (els.length > 0) els[0].focus();
				else dialog?.focus();
			});
			document.addEventListener('keydown', handleKeydown);
			return () => {
				document.removeEventListener('keydown', handleKeydown);
				previouslyFocused?.focus?.();
			};
		}
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
	});
</script>

{#if open}
	<div class="overlay" onclick={onClose} onkeydown={() => {}} role="presentation">
		<div
			bind:this={dialog}
			class="dialog glass"
			role="dialog"
			aria-modal="true"
			aria-labelledby={labelledBy}
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			{@render children()}
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: rgba(0, 0, 0, 0.65);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}
	.dialog {
		min-width: 320px;
		max-width: 560px;
		width: 100%;
		padding: 24px;
		font-family: var(--font-mono);
		color: var(--color-fg);
		outline: none;
	}
</style>
