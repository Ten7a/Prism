<script lang="ts">
	import { onMount } from 'svelte';
	import GenerationCard from '$lib/components/GenerationCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Quality = '1k' | '2k' | '4k';
	type Ratio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

	const RATIOS: Ratio[] = ['1:1', '4:3', '3:4', '16:9', '9:16'];
	const QUALITIES: Quality[] = ['1k', '2k', '4k'];
	const QUALITY_TO_MP: Record<Quality, number> = { '1k': 1, '2k': 4, '4k': 8 };
	const QUALITY_TO_OUTPUT_TOKENS: Record<Quality, number> = {
		'1k': 1290,
		'2k': 3870,
		'4k': 7740
	};
	const PROMPT_INPUT_TOKENS = 200;
	const USD_PER_TOKEN = 0.01;

	type PricingShape =
		| { shape: 'per-image-flat'; usd: number }
		| { shape: 'per-image-tier'; tiers: Record<string, number> }
		| { shape: 'per-mp'; firstUsd: number; subsequentUsd: number }
		| { shape: 'per-token'; inUsd: number; outUsd: number };

	type ModelView = (typeof data.models)[number];

	function estimateTokens(model: ModelView, q: Quality, batch: number): number {
		const p = model.pricing as PricingShape;
		let usd = 0;
		switch (p.shape) {
			case 'per-image-flat':
				usd = p.usd * batch;
				break;
			case 'per-image-tier': {
				const usdT = Object.values(p.tiers)[0] ?? 0;
				usd = usdT * batch;
				break;
			}
			case 'per-mp': {
				const mp = QUALITY_TO_MP[q];
				const perImage = p.firstUsd + Math.max(0, mp - 1) * p.subsequentUsd;
				usd = perImage * batch;
				break;
			}
			case 'per-token': {
				const out = QUALITY_TO_OUTPUT_TOKENS[q];
				usd = (PROMPT_INPUT_TOKENS * p.inUsd + out * p.outUsd) * batch;
				break;
			}
		}
		return Math.ceil(usd / USD_PER_TOKEN);
	}

	let prompt = $state('');
	let modelId = $state(data.models[0]?.id ?? '');
	let ratio = $state<Ratio>('1:1');
	let quality = $state<Quality>('1k');
	let batch = $state(1);
	let refKeys = $state<{ key: string; url: string }[]>(
		data.preloadRef ? [data.preloadRef] : []
	);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);

	interface ActiveJob {
		id: string;
		batch: number;
	}
	let activeJobs = $state<ActiveJob[]>([]);

	interface RecentJob {
		id: string;
		modelId: string;
		status: string;
		batch: number;
		costEstimate: number;
		costActual: number | null;
		createdAt: string;
		finishedAt: string | null;
	}
	let recent = $state<RecentJob[]>([]);

	const selectedModel = $derived(data.models.find((m) => m.id === modelId));
	const estimate = $derived(
		selectedModel ? estimateTokens(selectedModel, quality, batch) : 0
	);
	const balance = $derived(data.balance);
	const insufficient = $derived(estimate > balance);
	const promptValid = $derived(prompt.trim().length >= 1 && prompt.trim().length <= 4000);

	async function loadRecent(): Promise<void> {
		try {
			const r = await fetch('/api/generations');
			if (!r.ok) return;
			const body = (await r.json()) as { jobs?: RecentJob[] };
			recent = body.jobs ?? [];
		} catch {
			/* ignore */
		}
	}

	onMount(() => {
		void loadRecent();
	});

	async function handleFiles(files: FileList | null): Promise<void> {
		if (!files) return;
		for (const file of Array.from(files)) {
			const fd = new FormData();
			fd.append('file', file);
			try {
				const res = await fetch('/api/uploads', { method: 'POST', body: fd });
				if (!res.ok) {
					console.warn('upload failed', await res.text());
					continue;
				}
				const body = (await res.json()) as { key: string; url: string };
				refKeys = [...refKeys, { key: body.key, url: body.url }];
			} catch (err) {
				console.warn('upload error', (err as Error).message);
			}
		}
	}

	function removeRef(key: string): void {
		refKeys = refKeys.filter((r) => r.key !== key);
	}

	async function submit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (!promptValid || insufficient || submitting) return;
		submitting = true;
		submitError = null;
		try {
			const res = await fetch('/api/generations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: modelId,
					prompt: prompt.trim(),
					ratio,
					quality,
					batch,
					refImageKeys: refKeys.map((r) => r.key)
				})
			});
			if (!res.ok) {
				submitError = (await res.text()) || `error ${res.status}`;
				return;
			}
			const body = (await res.json()) as { id: string };
			activeJobs = [{ id: body.id, batch }, ...activeJobs];
			void loadRecent();
		} catch (err) {
			submitError = (err as Error).message;
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Generate · Prism</title>
</svelte:head>

<section class="generate">
	<header class="page-head">
		<span class="tag">/ generate</span>
		<span class="balance" data-testid="balance">{balance} tok</span>
	</header>

	<form class="composer" onsubmit={submit}>
		<label class="prompt">
			<span class="lbl">prompt</span>
			<textarea
				bind:value={prompt}
				placeholder="Describe an image"
				rows="4"
				maxlength="4000"
				required
			></textarea>
			<span class="counter">{prompt.length} / 4000</span>
		</label>

		<div class="row">
			<label class="field">
				<span class="lbl">model</span>
				<select bind:value={modelId} aria-label="Model">
					{#each data.models as m (m.id)}
						<option value={m.id}>{m.displayName}</option>
					{/each}
				</select>
			</label>

			<fieldset class="seg">
				<legend class="lbl">ratio</legend>
				{#each RATIOS as r (r)}
					<label class:active={ratio === r}>
						<input type="radio" name="ratio" value={r} bind:group={ratio} />
						{r}
					</label>
				{/each}
			</fieldset>

			<fieldset class="seg">
				<legend class="lbl">quality</legend>
				{#each QUALITIES as q (q)}
					<label class:active={quality === q}>
						<input type="radio" name="quality" value={q} bind:group={quality} />
						{q}
					</label>
				{/each}
			</fieldset>

			<label class="field stepper">
				<span class="lbl">batch</span>
				<input type="number" min="1" max="4" bind:value={batch} />
			</label>
		</div>

		<div class="refs">
			<span class="lbl">reference images</span>
			<input
				type="file"
				multiple
				accept="image/png,image/jpeg,image/webp"
				onchange={(e) => handleFiles((e.currentTarget as HTMLInputElement).files)}
			/>
			{#if refKeys.length > 0}
				<ul class="thumbs">
					{#each refKeys as r (r.key)}
						<li>
							<img src={r.url} alt="ref" />
							<button type="button" onclick={() => removeRef(r.key)}>×</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="actions">
			<span class="estimate">
				≈ {estimate} tokens
				{#if insufficient}<em class="low">(low balance)</em>{/if}
			</span>
			<button type="submit" disabled={!promptValid || insufficient || submitting}>
				{submitting ? 'submitting…' : 'generate'}
			</button>
		</div>

		{#if submitError}
			<p class="err">{submitError}</p>
		{/if}
	</form>

	{#if activeJobs.length > 0}
		<section class="active">
			<h2 class="lbl">active</h2>
			{#each activeJobs as j (j.id)}
				<GenerationCard jobId={j.id} batch={j.batch} />
			{/each}
		</section>
	{/if}

	{#if recent.length > 0}
		<section class="recent">
			<h2 class="lbl">recent</h2>
			<ul>
				{#each recent as j (j.id)}
					<li>
						<span class="rid">{j.id.slice(0, 8)}</span>
						<span class="rmodel">{j.modelId}</span>
						<span class="rstatus">{j.status}</span>
						<span class="rcost">{j.costActual ?? j.costEstimate} tok</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</section>

<style>
	.generate {
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
	.balance {
		color: var(--color-fg);
	}
	.composer {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.lbl {
		display: block;
		font-size: 10px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-fg-50);
		margin-bottom: 6px;
	}
	.prompt {
		display: flex;
		flex-direction: column;
		position: relative;
	}
	.prompt textarea {
		background: transparent;
		color: var(--color-fg);
		font-family: var(--font-mono);
		font-size: 14px;
		line-height: 1.5;
		border: 1px solid var(--color-rule);
		padding: 10px 12px;
		resize: vertical;
		min-height: 110px;
	}
	.prompt textarea:focus {
		outline: none;
		border-color: var(--color-fg);
	}
	.counter {
		align-self: flex-end;
		margin-top: 4px;
		font-size: 10px;
		color: var(--color-fg-30);
		letter-spacing: 0.1em;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 18px;
		align-items: flex-end;
	}
	.field {
		display: flex;
		flex-direction: column;
		min-width: 180px;
	}
	.field select,
	.field input {
		background: transparent;
		color: var(--color-fg);
		border: 1px solid var(--color-rule);
		padding: 8px 10px;
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.stepper input {
		width: 70px;
	}
	.seg {
		border: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
	}
	.seg > legend {
		display: block;
		font-size: 10px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-fg-50);
		margin-bottom: 6px;
		padding: 0;
	}
	.seg label {
		display: inline-block;
		border: 1px solid var(--color-rule);
		padding: 6px 10px;
		font-size: 12px;
		color: var(--color-fg-70);
		cursor: pointer;
		margin-right: -1px;
	}
	.seg label.active {
		color: var(--color-fg);
		border-color: var(--color-fg);
		background: rgba(255, 255, 255, 0.04);
	}
	.seg input {
		display: none;
	}
	.refs input[type='file'] {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-fg-70);
	}
	.thumbs {
		list-style: none;
		display: flex;
		gap: 8px;
		padding: 0;
		margin: 10px 0 0;
		flex-wrap: wrap;
	}
	.thumbs li {
		position: relative;
		width: 60px;
		height: 60px;
		border: 1px solid var(--color-rule);
	}
	.thumbs img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.thumbs button {
		position: absolute;
		top: -8px;
		right: -8px;
		background: #000;
		color: #fff;
		border: 1px solid var(--color-rule);
		width: 18px;
		height: 18px;
		font-size: 12px;
		line-height: 1;
		cursor: pointer;
	}
	.actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px solid var(--color-rule);
		padding-top: 14px;
	}
	.estimate {
		font-size: 12px;
		color: var(--color-fg-70);
		letter-spacing: 0.08em;
	}
	.estimate .low {
		font-style: normal;
		color: #ff8b8b;
		margin-left: 8px;
	}
	.actions button {
		background: var(--color-fg);
		color: #000;
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		padding: 10px 22px;
		border: 1px solid var(--color-fg);
		cursor: pointer;
	}
	.actions button:disabled {
		background: transparent;
		color: var(--color-fg-30);
		border-color: var(--color-rule);
		cursor: not-allowed;
	}
	.err {
		color: #ff8b8b;
		font-size: 12px;
	}
	.active,
	.recent {
		margin-top: 36px;
	}
	.recent ul {
		list-style: none;
		padding: 0;
		margin: 8px 0 0;
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--color-rule);
	}
	.recent li {
		display: grid;
		grid-template-columns: 100px 1fr 100px 100px;
		gap: 12px;
		font-size: 12px;
		padding: 8px 0;
		border-bottom: 1px solid var(--color-rule);
		color: var(--color-fg-70);
	}
	.rid {
		color: var(--color-fg-50);
	}
	.rstatus {
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
</style>
