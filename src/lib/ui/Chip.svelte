<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		title?: string;
	};

	let { children, title }: Props = $props();
</script>

<span class="chip" {title}>
	{@render children()}
</span>
