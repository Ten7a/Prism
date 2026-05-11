<script lang="ts">
	import {
		Button,
		Chip,
		Tag,
		SectionHeader,
		RuleRow,
		Field,
		Modal,
		Spinner,
		type ButtonVariant,
		type ButtonSize
	} from '$lib/ui';
	import { push } from '$lib/stores/toast';

	let buttonVariant = $state<ButtonVariant>('primary');
	let buttonSize = $state<ButtonSize>('md');
	let chipText = $state('1k');
	let modalOpen = $state(false);
	let fieldValue = $state('');
	let fieldError = $state('');
</script>

<svelte:head><title>Design · Prism</title></svelte:head>

<section class="gallery">
	<header class="head">
		<h1>Design system</h1>
		<p class="lede">Dev-only gallery. 404 in prod builds.</p>
	</header>

	<article id="buttons">
		<SectionHeader title="Buttons" caption="Primary, ghost, danger; sm/md sizes." />
		<div class="example">
			<Button variant={buttonVariant} size={buttonSize}>Action</Button>
			<Button variant={buttonVariant} size={buttonSize} disabled>Disabled</Button>
		</div>
		<div class="controls">
			<label>
				variant
				<select bind:value={buttonVariant}>
					<option value="primary">primary</option>
					<option value="ghost">ghost</option>
					<option value="danger">danger</option>
				</select>
			</label>
			<label>
				size
				<select bind:value={buttonSize}>
					<option value="sm">sm</option>
					<option value="md">md</option>
				</select>
			</label>
		</div>
		<pre><code>{`<Button variant="${buttonVariant}" size="${buttonSize}">Action</Button>`}</code
			></pre>
	</article>

	<article id="chips">
		<SectionHeader title="Chips" caption="Uppercase, 10px tracked, rounded full." />
		<div class="example">
			<Chip>{chipText}</Chip>
			<Chip>16:9</Chip>
			<Chip>gpt-image</Chip>
		</div>
		<div class="controls">
			<label>
				text
				<input bind:value={chipText} />
			</label>
		</div>
		<pre><code>{`<Chip>${chipText}</Chip>`}</code></pre>
	</article>

	<article id="tags">
		<SectionHeader title="Tags" caption="Section labels — '/ pricing'." />
		<div class="example"><Tag>/ design</Tag></div>
		<pre><code>{`<Tag>/ design</Tag>`}</code></pre>
	</article>

	<article id="section-header">
		<SectionHeader
			title="Section header"
			caption="Title + optional caption + right-slot actions."
		/>
		<pre><code>{`<SectionHeader title="Pricing" caption="Tokens · packs" />`}</code></pre>
	</article>

	<article id="rule-row">
		<SectionHeader title="Rule rows" caption="Hover shifts content right." />
		<div class="rows">
			{#snippet row1Left()}<span>Buy 1000</span>{/snippet}
			{#snippet row1Center()}<span>$10.00</span>{/snippet}
			{#snippet row1Right()}<span>checkout →</span>{/snippet}
			<RuleRow href="#" left={row1Left} center={row1Center} right={row1Right} />
			{#snippet row2Left()}<span>Buy 2500</span>{/snippet}
			{#snippet row2Center()}<span>$22.50</span>{/snippet}
			{#snippet row2Right()}<span>checkout →</span>{/snippet}
			<RuleRow href="#" left={row2Left} center={row2Center} right={row2Right} />
		</div>
		<pre><code>{`<RuleRow href="#" left={left} center={center} right={right} />`}</code></pre>
	</article>

	<article id="field">
		<SectionHeader title="Field" caption="Mono input with white-15 underline." />
		<div class="example example-stack">
			<Field
				label="Email"
				type="email"
				bind:value={fieldValue}
				hint="We won't share it."
				error={fieldError}
			/>
			<Button variant="ghost" onclick={() => (fieldError = fieldError ? '' : 'Required')}>
				Toggle error
			</Button>
		</div>
		<pre><code>{`<Field label="Email" type="email" bind:value error="Required" />`}</code></pre>
	</article>

	<article id="modal">
		<SectionHeader title="Modal" caption="ESC to close. Focus trapped." />
		<div class="example">
			<Button onclick={() => (modalOpen = true)}>Open modal</Button>
		</div>
		<Modal open={modalOpen} onClose={() => (modalOpen = false)}>
			<h3 id="modal-title">Confirm</h3>
			<p>This is a modal example.</p>
			<div class="modal-actions">
				<Button variant="ghost" onclick={() => (modalOpen = false)}>Cancel</Button>
				<Button onclick={() => (modalOpen = false)}>OK</Button>
			</div>
		</Modal>
		<pre><code>{`<Modal open onClose={() => open = false}>...</Modal>`}</code></pre>
	</article>

	<article id="toast">
		<SectionHeader title="Toast" caption="Bottom-center, auto-dismiss 4s." />
		<div class="example">
			<Button onclick={() => push('Saved.')}>Push toast</Button>
		</div>
		<pre><code>{`import { push } from '$lib/stores/toast'; push('Saved.');`}</code></pre>
	</article>

	<article id="spinner">
		<SectionHeader title="Spinner" caption="Mono dots; reuses --animate-blink." />
		<div class="example"><Spinner /></div>
		<pre><code>{`<Spinner />`}</code></pre>
	</article>
</section>

<style>
	.gallery {
		max-width: 880px;
		margin: 0 auto;
		padding: 40px var(--spacing-pad) 80px;
		font-family: var(--font-mono);
		color: var(--color-fg);
	}
	.head {
		margin-bottom: 32px;
		padding-bottom: 18px;
		border-bottom: 1px solid var(--color-rule);
	}
	.head h1 {
		font-size: 16px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		margin: 0;
	}
	.lede {
		font-size: 12px;
		color: var(--color-fg-50);
		margin: 8px 0 0;
	}
	article {
		padding: 28px 0;
		border-bottom: 1px solid var(--color-rule);
	}
	.example {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		align-items: center;
		margin: 18px 0;
	}
	.example-stack {
		flex-direction: column;
		align-items: stretch;
	}
	.controls {
		display: flex;
		gap: 18px;
		margin-bottom: 14px;
	}
	.controls label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-fg-50);
	}
	.controls input,
	.controls select {
		background: transparent;
		color: var(--color-fg);
		border: 1px solid var(--color-rule);
		padding: 6px 8px;
		font-family: var(--font-mono);
		font-size: 12px;
	}
	pre {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--color-rule);
		padding: 12px;
		font-size: 11px;
		color: var(--color-fg-70);
		overflow-x: auto;
		margin: 0;
	}
	.rows {
		margin: 18px 0;
		border-top: 1px solid var(--color-rule);
	}
	.modal-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 18px;
	}
</style>
