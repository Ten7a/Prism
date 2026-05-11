<script lang="ts">
	import '$lib/styles/auth.css';
	import { enhance } from '$app/forms';
	import { Button, Field } from '$lib/ui';

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
		<Field
			label="Email"
			type="email"
			name="email"
			autocomplete="email"
			required
			value={form?.email ?? ''}
		/>
		<Field
			label="Password"
			type="password"
			name="password"
			autocomplete="current-password"
			required
		/>
		<Button type="submit" variant="primary">Sign in</Button>
	</form>

	{#if form && 'unverified' in form && form.unverified}
		<form method="POST" action="?/resend" class="auth-form" use:enhance style="margin-top:14px">
			<input type="hidden" name="email" value={form?.email ?? ''} />
			<Button type="submit" variant="ghost">Resend verification email</Button>
		</form>
	{/if}

	<div class="auth-foot">
		<a href="/signup">Create account</a>
		<a href="/reset">Forgot password</a>
	</div>
</section>
