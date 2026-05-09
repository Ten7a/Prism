<script lang="ts">
	import { onMount } from 'svelte';

	interface ImageEvent {
		i: number;
		imageId: string;
		key: string;
		url?: string;
		width: number;
		height: number;
		mime: string;
		bytes: number;
	}

	let { jobId, batch }: { jobId: string; batch: number } = $props();

	let images = $state<Record<number, ImageEvent>>({});
	let status = $state<'running' | 'done' | 'error'>('running');
	let errorCode = $state<string | null>(null);
	let costActual = $state<number | null>(null);
	let source: EventSource | null = null;

	function imgSrc(im: ImageEvent): string {
		return im.url ?? `/api/images/${im.imageId}`;
	}

	function closeStream(): void {
		if (source) {
			source.close();
			source = null;
		}
	}

	function attach(): void {
		closeStream();
		images = {};
		status = 'running';
		errorCode = null;
		costActual = null;

		const es = new EventSource(`/api/generations/${jobId}/events`);
		source = es;
		es.onmessage = (msg) => {
			let evt: { type: string } & Record<string, unknown>;
			try {
				evt = JSON.parse(msg.data);
			} catch {
				return;
			}
			switch (evt.type) {
				case 'image': {
					const im = evt as unknown as ImageEvent & { type: 'image' };
					images = { ...images, [im.i]: im };
					break;
				}
				case 'shard_error': {
					// Mark slot as errored — surfaced via skeleton wrapper.
					break;
				}
				case 'done': {
					status = 'done';
					costActual = (evt.costActual as number) ?? null;
					closeStream();
					break;
				}
				case 'error': {
					status = 'error';
					errorCode = (evt.code as string) ?? 'unknown';
					closeStream();
					break;
				}
				case 'heartbeat':
				case 'progress':
				default:
					break;
			}
		};
		es.onerror = () => {
			// Network blip — let EventSource auto-retry; if the server already closed, the
			// onmessage handler above will have set the terminal state.
		};
	}

	onMount(() => {
		attach();
		return () => closeStream();
	});

	const tiles = $derived(Array.from({ length: Math.max(batch, 1) }, (_, i) => i));
</script>

<section class="card" data-testid="generation-card">
	<header class="card-head">
		<span class="tag">JOB</span>
		<span class="job-id">{jobId.slice(0, 8)}</span>
		{#if status === 'running'}
			<span class="status running" data-testid="job-progress">RUNNING</span>
		{:else if status === 'done'}
			<span class="status done">DONE{costActual != null ? ` · ${costActual} tok` : ''}</span>
		{:else}
			<span class="status err">FAILED · {errorCode}</span>
		{/if}
	</header>

	<div class="grid">
		{#each tiles as i (i)}
			{@const im = images[i]}
			<div class="tile" class:filled={!!im}>
				{#if im}
					<img
						src={imgSrc(im)}
						alt="generation {i + 1}"
						width={im.width}
						height={im.height}
						data-testid="generated"
					/>
				{:else if status === 'error'}
					<div class="empty err">—</div>
				{:else}
					<div class="empty">. . .</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if status === 'error'}
		<button type="button" class="retry" onclick={attach}>retry stream</button>
	{/if}
</section>

<style>
	.card {
		border: 1px solid var(--color-rule);
		padding: 14px;
		margin-top: 16px;
		font-family: var(--font-mono);
	}
	.card-head {
		display: flex;
		gap: 12px;
		align-items: center;
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-fg-70);
		margin-bottom: 12px;
	}
	.job-id {
		color: var(--color-fg-50);
	}
	.status.running {
		color: var(--color-fg);
	}
	.status.done {
		color: var(--color-fg);
	}
	.status.err {
		color: #ff8b8b;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 10px;
	}
	.tile {
		aspect-ratio: 1 / 1;
		border: 1px solid var(--color-rule);
		display: grid;
		place-items: center;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.02);
	}
	.tile.filled {
		border-color: var(--color-fg-30);
	}
	.tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.empty {
		font-size: 11px;
		color: var(--color-fg-30);
		letter-spacing: 0.3em;
	}
	.empty.err {
		color: #ff8b8b;
	}
	.retry {
		margin-top: 12px;
		background: transparent;
		border: 1px solid var(--color-rule);
		color: var(--color-fg);
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 6px 12px;
		cursor: pointer;
	}
	.retry:hover {
		border-color: var(--color-fg);
	}
</style>
