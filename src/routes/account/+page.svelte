<script lang="ts">
	import '$lib/styles/auth.css';
	import { enhance } from '$app/forms';
	import { Button, Field, Tag } from '$lib/ui';

	let { data, form } = $props();
	const deleteForm = $derived(form as { error?: string } | null);
	let confirming = $state(false);
</script>

<svelte:head><title>Account · Prism</title></svelte:head>

<section class="account">
	<header>
		<Tag>Account</Tag>
		<h1>{data.email}</h1>
		<p class="meta">
			{data.emailVerified ? 'Verified' : 'Unverified'} · Balance
			<strong data-testid="balance">{data.balance}</strong> tokens
		</p>
	</header>

	<div class="grid">
		<div class="block">
			<h2>Recent generations</h2>
			{#if data.recent.length === 0}
				<p class="muted">No generations yet. <a href="/generate">Start one</a>.</p>
			{:else}
				<ul class="recent">
					{#each data.recent as item (item.id)}
						<li>
							<a href={`/library/${item.id}`}>{item.id.slice(0, 8)}</a>
							<time>{new Date(item.createdAt).toLocaleString()}</time>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="block">
			<h2>Receipts</h2>
			{#if data.hasBilling}
				<form method="POST" action="/api/billing/portal">
					<Button type="submit" variant="primary">Manage billing & receipts</Button>
				</form>
			{:else}
				<p class="muted">
					Buy a token pack from <a href="/pricing">/pricing</a> to unlock invoices and receipts.
				</p>
			{/if}
		</div>

		<div class="danger block">
			<h2>Danger zone</h2>
			<p class="muted">Delete your account and all data. This cannot be undone.</p>
			{#if !confirming}
				<Button variant="danger" onclick={() => (confirming = true)}>Delete account</Button>
			{:else}
				{#if deleteForm?.error}<div class="auth-error">{deleteForm.error}</div>{/if}
				<form method="POST" action="/account/delete" class="auth-form" use:enhance>
					<Field
						label="Confirm password"
						type="password"
						name="password"
						autocomplete="current-password"
						required
					/>
					<div class="row">
						<Button type="submit" variant="danger">Permanently delete</Button>
						<Button type="button" variant="ghost" onclick={() => (confirming = false)}
							>Cancel</Button
						>
					</div>
				</form>
			{/if}
		</div>
	</div>
</section>

<style>
	.account {
		max-width: 720px;
		margin: 60px auto;
		padding: 0 var(--spacing-pad);
		font-family: var(--font-mono);
		color: var(--color-fg);
	}

	header {
		border-bottom: 1px solid var(--color-rule);
		padding-bottom: 22px;
		margin-bottom: 28px;
	}

	header h1 {
		font-family: var(--font-mono);
		font-weight: 500;
		font-size: 22px;
		letter-spacing: -0.01em;
		margin: 6px 0 4px;
	}

	.meta {
		font-size: 12px;
		color: var(--color-fg-70);
		margin: 0;
	}

	.meta strong {
		color: var(--color-fg);
		font-weight: 500;
	}

	.grid {
		display: flex;
		flex-direction: column;
		gap: 1px;
		background: var(--color-rule);
		border: 1px solid var(--color-rule);
	}

	.block {
		background: #000;
		padding: 22px;
	}

	.block h2 {
		font-family: var(--font-mono);
		font-weight: 500;
		font-size: 12px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		margin: 0 0 14px;
		color: var(--color-fg-70);
	}

	.muted {
		color: var(--color-fg-50);
		font-size: 12px;
		margin: 0;
	}

	.muted a {
		color: var(--color-fg);
	}

	.recent {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 12px;
	}

	.recent li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}

	.recent a {
		color: var(--color-fg);
		text-decoration: none;
	}

	.recent time {
		color: var(--color-fg-50);
	}

	.row {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}
</style>
