<script lang="ts">
	import '$lib/styles/auth.css';
	import { enhance } from '$app/forms';
	import { Button, Field } from '$lib/ui';

	let { form } = $props();
</script>

<svelte:head><title>Sign up · Prism</title></svelte:head>

<section class="auth-shell">
	<h1>Create account</h1>
	<p class="lede">Start generating in mono.</p>

	{#if form?.signedUp}
		<div class="auth-success">
			Account created. Check <strong>{form.email}</strong> for a verification link.
		</div>
	{:else}
		{#if form?.error}<div class="auth-error">{form.error}</div>{/if}
		<form method="POST" class="auth-form" use:enhance>
			<Field label="Name" name="name" autocomplete="name" value={form?.name ?? ''} />
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
				autocomplete="new-password"
				required
				minlength={8}
			/>
			<Button type="submit" variant="primary">Sign up</Button>
		</form>
	{/if}

	<div class="auth-foot">
		<a href="/login">Already have an account</a>
	</div>
</section>
