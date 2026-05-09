<script lang="ts">
	import '$lib/styles/auth.css';
	import { enhance } from '$app/forms';

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
			<label>
				Name
				<input type="text" name="name" autocomplete="name" value={form?.name ?? ''} />
			</label>
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
			<label>
				Password
				<input type="password" name="password" autocomplete="new-password" required minlength="8" />
			</label>
			<button type="submit">Sign up</button>
		</form>
	{/if}

	<div class="auth-foot">
		<a href="/login">Already have an account</a>
	</div>
</section>
