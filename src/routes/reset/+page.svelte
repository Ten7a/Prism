<script lang="ts">
	import '$lib/styles/auth.css';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head><title>Reset password · Prism</title></svelte:head>

<section class="auth-shell">
	{#if data.token}
		<h1>New password</h1>
		<p class="lede">Choose a new password for your account.</p>

		{#if form?.error}<div class="auth-error">{form.error}</div>{/if}

		<form method="POST" action="?/confirm" class="auth-form" use:enhance>
			<input type="hidden" name="token" value={data.token} />
			<label>
				New password
				<input type="password" name="password" autocomplete="new-password" required minlength="8" />
			</label>
			<button type="submit">Set password</button>
		</form>
	{:else}
		<h1>Reset password</h1>
		<p class="lede">We'll email a reset link.</p>

		{#if form?.sent}
			<div class="auth-success">Reset email sent to <strong>{form.email}</strong>.</div>
		{:else}
			{#if form?.error}<div class="auth-error">{form.error}</div>{/if}
			<form method="POST" action="?/request" class="auth-form" use:enhance>
				<label>
					Email
					<input
						type="email"
						name="email"
						autocomplete="email"
						required
						value={form?.email ?? ''}
					/>
				</label>
				<button type="submit">Send reset link</button>
			</form>
		{/if}
	{/if}

	<div class="auth-foot">
		<a href="/login">Back to sign in</a>
	</div>
</section>
