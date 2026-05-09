<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let exporting = $state(false);

	async function exportData() {
		exporting = true;
		try {
			const res = await fetch('/api/account/export');
			if (!res.ok) throw new Error('Export failed');
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `prism-export-${Date.now()}.json`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} finally {
			exporting = false;
		}
	}
</script>

<svelte:head>
	<title>Your data · Prism</title>
</svelte:head>

<section class="page">
	<header>
		<h1>Your data</h1>
		<p>Adjust consent, see your history, export everything we hold, or delete your account.</p>
	</header>

	<section class="card">
		<h2>Consent preferences</h2>
		<form method="post" action="?/update" use:enhance>
			<label class="row">
				<input type="checkbox" checked disabled />
				<span>Necessary <em>(always on)</em></span>
			</label>
			<label class="row">
				<input
					type="checkbox"
					name="analytics"
					checked={data.current?.analytics ?? false}
				/>
				<span>Analytics</span>
			</label>
			<label class="row">
				<input type="checkbox" name="ads" checked={data.current?.ads ?? false} />
				<span>Ads</span>
			</label>
			<button type="submit" class="primary">Save preferences</button>
			{#if form?.saved}
				<span class="ok">Saved.</span>
			{:else if form?.error}
				<span class="err">{form.error}</span>
			{/if}
		</form>
	</section>

	<section class="card">
		<h2>Consent history</h2>
		{#if data.history.length === 0}
			<p class="muted">No consent records yet.</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th>Date</th>
						<th>Version</th>
						<th>Analytics</th>
						<th>Ads</th>
					</tr>
				</thead>
				<tbody>
					{#each data.history as row (row.id)}
						<tr>
							<td>{new Date(row.acceptedAt).toLocaleString()}</td>
							<td>{row.version}</td>
							<td>{row.analytics ? 'yes' : 'no'}</td>
							<td>{row.ads ? 'yes' : 'no'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section class="card">
		<h2>Export my data</h2>
		<p>Download a JSON file containing your account, generations, images, ledger, and consent records.</p>
		<button type="button" class="primary" onclick={exportData} disabled={exporting}>
			{exporting ? 'Preparing…' : 'Download export'}
		</button>
	</section>

	<section class="card danger">
		<h2>Delete my account</h2>
		<p>Permanently removes your account and all associated data. This cannot be undone.</p>
		<a class="primary danger-btn" href="/account/delete">Continue to delete</a>
	</section>
</section>

<style>
	.page {
		max-width: 64ch;
		margin: 0 auto;
		padding: 2rem var(--spacing-pad, 1rem);
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		color: var(--color-fg);
	}
	h1 {
		font-size: 1.4rem;
		margin: 0 0 0.5rem;
	}
	header p {
		opacity: 0.7;
	}
	.card {
		border: 1px solid var(--color-rule, #333);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.card h2 {
		font-size: 1rem;
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.row em {
		opacity: 0.5;
		font-style: normal;
	}
	button.primary,
	a.primary {
		display: inline-block;
		padding: 0.5rem 0.9rem;
		background: var(--color-fg);
		border: 1px solid var(--color-fg);
		color: #000;
		font: inherit;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.8rem;
		cursor: pointer;
		text-decoration: none;
		align-self: flex-start;
	}
	button.primary:disabled {
		opacity: 0.5;
	}
	.danger-btn {
		background: transparent;
		border: 1px solid #c66;
		color: #c66;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}
	th,
	td {
		border: 1px solid var(--color-rule, #333);
		padding: 0.4rem 0.6rem;
		text-align: left;
	}
	.muted {
		opacity: 0.6;
	}
	.ok {
		color: #6b6;
	}
	.err {
		color: #c66;
	}
</style>
