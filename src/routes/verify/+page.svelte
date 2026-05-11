<script lang="ts">
	import '$lib/styles/auth.css';
	let { data } = $props();
</script>

<svelte:head><title>Email verified · Prism</title></svelte:head>

<section class="auth-shell">
	{#if data.error}
		<h1>Verification failed</h1>
		<div class="auth-error">{data.error}</div>
		<div class="auth-foot">
			<a href="/login">Return to sign in</a>
		</div>
	{:else}
		<h1>Email verified</h1>
		<p class="lede">Your account is ready.</p>
		<div class="auth-success">Email verified successfully.</div>
		<div class="auth-foot">
			<a href={data.signedIn ? '/account' : '/login'}>Continue</a>
		</div>
	{/if}
</section>
