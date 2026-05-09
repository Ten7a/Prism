<script lang="ts">
	import '$lib/styles/auth.css';
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head><title>Sign in · Prism</title></svelte:head>

<section class="auth-shell">
	<h1>Sign in</h1>
	<p class="lede">Welcome back.</p>

	{#if form?.resent}
		<div class="auth-success">Verification email sent. Check your inbox.</div>
	{:else if form && 'error' in form && form.error}
		<div class="auth-error">{form.error}</div>
	{/if}

	<form method="POST" action="?/signin" class="auth-form" use:enhance>
		<label>
			Email
			<input type="email" name="email" autocomplete="email" required value={form?.email ?? ''} />
		</label>
		<label>
			Password
			<input type="password" name="password" autocomplete="current-password" required />
		</label>
		<button type="submit">Sign in</button>
	</form>

	{#if form && 'unverified' in form && form.unverified}
		<form method="POST" action="?/resend" class="auth-form" use:enhance style="margin-top:14px">
			<input type="hidden" name="email" value={form?.email ?? ''} />
			<button type="submit" class="ghost">Resend verification email</button>
		</form>
	{/if}

	<div class="auth-foot">
		<a href="/signup">Create account</a>
		<a href="/reset">Forgot password</a>
	</div>
</section>
