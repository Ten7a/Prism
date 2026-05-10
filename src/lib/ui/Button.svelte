<script lang="ts" module>
	export type ButtonVariant = 'primary' | 'ghost' | 'danger';
	export type ButtonSize = 'sm' | 'md';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		variant?: ButtonVariant;
		size?: ButtonSize;
		children: Snippet;
	};

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		children,
		...rest
	}: Props = $props();
</script>

<button {type} class="btn {variant} {size}" {...rest}>
	{@render children()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #000;
		color: var(--color-fg);
		border: 1px solid var(--color-fg);
		font-family: var(--font-mono);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
	}
	.md {
		padding: 11px 16px;
		font-size: 11px;
	}
	.sm {
		padding: 7px 12px;
		font-size: 10px;
	}
	.btn:hover:not(:disabled) {
		background: var(--color-fg);
		color: #000;
	}
	.btn:disabled {
		color: var(--color-fg-30);
		border-color: var(--color-rule);
		cursor: not-allowed;
	}

	.primary {
		background: var(--color-fg);
		color: #000;
	}
	.primary:hover:not(:disabled) {
		background: #000;
		color: var(--color-fg);
	}

	.ghost {
		background: transparent;
		color: var(--color-fg-70);
		border-color: var(--color-rule);
	}
	.ghost:hover:not(:disabled) {
		background: transparent;
		color: var(--color-fg);
		border-color: var(--color-fg);
	}

	.danger {
		background: #000;
		color: var(--color-fg);
		border-color: var(--color-fg);
		box-shadow: inset 0 -1px 0 rgba(255, 139, 139, 0.5);
	}
	.danger:hover:not(:disabled) {
		background: var(--color-fg);
		color: #000;
	}
</style>
