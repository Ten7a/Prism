<script lang="ts">
	import { onMount } from 'svelte';
	import ImageTile from '$lib/components/ImageTile.svelte';
	import AdSlot from '$lib/components/AdSlot.svelte';
	import { Tag } from '$lib/ui';
	import type { PageData } from './$types';
	import type { LibraryItem } from '$lib/server/library/queries';

	let { data }: { data: PageData } = $props();

	let items = $state<LibraryItem[]>([...data.initial.items]);
	let cursor = $state<string | null>(data.initial.nextCursor);
	let loading = $state(false);
	let errMsg = $state<string | null>(null);
	let sentinel = $state<HTMLDivElement | null>(null);

	async function loadMore(): Promise<void> {
		if (loading || !cursor) return;
		loading = true;
		errMsg = null;
		try {
			const res = await fetch(`/api/library?cursor=${encodeURIComponent(cursor)}&limit=24`);
			if (!res.ok) {
				errMsg = `error ${res.status}`;
				return;
			}
			const body = (await res.json()) as { items: LibraryItem[]; nextCursor: string | null };
			items = [...items, ...body.items];
			cursor = body.nextCursor;
		} catch (err) {
			errMsg = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (!sentinel) return;
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) void loadMore();
				}
			},
			{ rootMargin: '400px' }
		);
		io.observe(sentinel);
		return () => io.disconnect();
	});
</script>

<svelte:head>
	<title>Library · Prism</title>
</svelte:head>

<section class="library">
	<header class="page-head">
		<Tag>/ library</Tag>
		<span class="count">{items.length}{cursor ? '+' : ''}</span>
	</header>

	<AdSlot slot="library-top" />

	{#if items.length === 0}
		<p class="empty">No images yet. <a href="/generate">Generate one →</a></p>
	{:else}
		<div class="grid">
			{#each items as it (it.id)}
				<ImageTile id={it.id} modelId={it.modelId} ratio={it.ratio} />
			{/each}
		</div>
	{/if}

	<div bind:this={sentinel} data-testid="sentinel" class="sentinel"></div>
	{#if loading}
		<p class="status">loading…</p>
	{/if}
	{#if errMsg}
		<p class="err">{errMsg}</p>
	{/if}
</section>

<style>
	.library {
		max-width: 1200px;
		margin: 0 auto;
		padding: 32px var(--spacing-pad) 80px;
		font-family: var(--font-mono);
	}
	.page-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 11px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-fg-70);
		border-bottom: 1px solid var(--color-rule);
		padding-bottom: 10px;
		margin-bottom: 18px;
	}
	.count {
		color: var(--color-fg);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 12px;
	}
	.empty {
		font-size: 13px;
		color: var(--color-fg-50);
		padding: 40px 0;
		text-align: center;
	}
	.empty a {
		color: var(--color-fg);
	}
	.sentinel {
		height: 1px;
	}
	.status,
	.err {
		font-size: 11px;
		color: var(--color-fg-50);
		text-align: center;
		padding-top: 16px;
		letter-spacing: 0.12em;
	}
	.err {
		color: #ff8b8b;
	}
</style>
