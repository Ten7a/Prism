<script lang="ts">
	import { toasts, dismiss } from '$lib/stores/toast';
</script>

<div class="stack" role="region" aria-live="polite" aria-label="Notifications">
	{#each $toasts as t (t.id)}
		<button class="toast" onclick={() => dismiss(t.id)} type="button">
			{t.message}
		</button>
	{/each}
</div>

<style>
	.stack {
		position: fixed;
		left: 50%;
		bottom: 24px;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column-reverse;
		gap: 8px;
		z-index: 10000;
		pointer-events: none;
	}
	.toast {
		pointer-events: auto;
		background: rgba(0, 0, 0, 0.85);
		color: var(--color-fg);
		border: 1px solid var(--color-fg-15);
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		padding: 10px 14px;
		cursor: pointer;
		min-width: 220px;
		text-align: left;
		backdrop-filter: blur(10px);
	}
	.toast:hover {
		border-color: var(--color-fg);
	}
</style>
