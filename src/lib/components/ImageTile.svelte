<script lang="ts">
	interface Props {
		id: string;
		modelId: string;
		ratio: string;
	}
	let { id, modelId, ratio }: Props = $props();
</script>

<a class="tile" href="/library/{id}" data-testid="image-tile">
	<img src="/api/images/{id}" alt="" loading="lazy" />
	<div class="overlay">
		<span class="model">{modelId}</span>
		<span class="ratio">{ratio}</span>
	</div>
</a>

<style>
	.tile {
		position: relative;
		display: block;
		aspect-ratio: 1 / 1;
		overflow: hidden;
		border: 1px solid var(--color-rule);
		background: rgba(255, 255, 255, 0.02);
	}
	.tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.overlay {
		position: absolute;
		inset: auto 0 0 0;
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 8px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-fg);
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
		opacity: 0;
		transition: opacity 120ms ease;
	}
	.tile:hover .overlay,
	.tile:focus-visible .overlay {
		opacity: 1;
	}
	.model {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
