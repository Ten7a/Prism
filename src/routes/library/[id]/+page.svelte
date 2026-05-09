<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let deleting = $state(false);
	let errMsg = $state<string | null>(null);

	async function onDelete(): Promise<void> {
		if (deleting) return;
		if (!confirm('Delete this image? This cannot be undone.')) return;
		deleting = true;
		errMsg = null;
		try {
			const res = await fetch(`/api/library/${data.image.id}`, { method: 'DELETE' });
			if (res.status !== 204) {
				errMsg = `error ${res.status}`;
				return;
			}
			await goto('/library');
		} catch (err) {
			errMsg = (err as Error).message;
		} finally {
			deleting = false;
		}
	}

	function fmtDate(d: Date | string): string {
		const t = typeof d === 'string' ? new Date(d) : d;
		return t.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
	}
</script>

<svelte:head>
	<title>Image · Prism</title>
</svelte:head>

<section class="detail">
	<header class="page-head">
		<a class="back" href="/library">← library</a>
		<span class="id">{data.image.id.slice(0, 8)}</span>
	</header>

	<div class="image">
		<img src={data.signedUrl} alt={data.image.prompt} />
	</div>

	<dl class="meta">
		<dt>prompt</dt>
		<dd class="prompt">{data.image.prompt}</dd>
		<dt>model</dt>
		<dd>{data.image.modelId}</dd>
		<dt>ratio</dt>
		<dd>{data.image.ratio}</dd>
		<dt>quality</dt>
		<dd>{data.image.quality}</dd>
		<dt>batch index</dt>
		<dd>{data.image.batchIndex}</dd>
		<dt>generated</dt>
		<dd>{fmtDate(data.image.createdAt)}</dd>
	</dl>

	<div class="actions">
		<a class="btn" href={data.signedUrl} download data-testid="download">download</a>
		<a class="btn" href="/generate?seed={data.image.jobId}">remix prompt</a>
		<a class="btn" href="/generate?ref={data.image.id}">use as reference</a>
		<button
			class="btn danger"
			type="button"
			onclick={onDelete}
			disabled={deleting}
			data-testid="delete"
		>
			{deleting ? 'deleting…' : 'delete'}
		</button>
	</div>

	{#if errMsg}
		<p class="err">{errMsg}</p>
	{/if}
</section>

<style>
	.detail {
		max-width: 880px;
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
	.back {
		color: var(--color-fg-70);
		text-decoration: none;
	}
	.back:hover {
		color: var(--color-fg);
	}
	.id {
		color: var(--color-fg-50);
	}
	.image {
		border: 1px solid var(--color-rule);
		display: flex;
		justify-content: center;
		background: rgba(0, 0, 0, 0.4);
	}
	.image img {
		max-width: 100%;
		height: auto;
		display: block;
	}
	.meta {
		display: grid;
		grid-template-columns: 140px 1fr;
		gap: 6px 18px;
		margin: 24px 0;
		font-size: 12px;
	}
	.meta dt {
		color: var(--color-fg-50);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-size: 10px;
		align-self: center;
	}
	.meta dd {
		margin: 0;
		color: var(--color-fg);
	}
	.prompt {
		white-space: pre-wrap;
		line-height: 1.5;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		border-top: 1px solid var(--color-rule);
		padding-top: 16px;
	}
	.btn {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		padding: 8px 14px;
		border: 1px solid var(--color-rule);
		color: var(--color-fg);
		background: transparent;
		cursor: pointer;
		text-decoration: none;
	}
	.btn:hover {
		border-color: var(--color-fg);
	}
	.btn.danger {
		color: #ff8b8b;
		border-color: #ff8b8b55;
	}
	.btn.danger:hover {
		border-color: #ff8b8b;
	}
	.btn:disabled {
		color: var(--color-fg-30);
		cursor: not-allowed;
	}
	.err {
		color: #ff8b8b;
		font-size: 12px;
		margin-top: 12px;
	}
</style>
