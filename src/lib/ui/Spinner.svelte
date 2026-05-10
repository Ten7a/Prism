<script lang="ts">
	type Props = { label?: string };
	let { label = 'Loading' }: Props = $props();
</script>

<span class="spinner" role="status" aria-label={label}>
	<span class="dot d1">.</span><span class="dot d2">.</span><span class="dot d3">.</span>
</span>

<style>
	.spinner {
		display: inline-flex;
		font-family: var(--font-mono);
		color: var(--color-fg-70);
		letter-spacing: 0.2em;
	}
	.dot {
		animation: var(--animate-blink);
	}
	.d2 {
		animation-delay: 0.15s;
	}
	.d3 {
		animation-delay: 0.3s;
	}
</style>
