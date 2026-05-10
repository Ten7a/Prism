<script lang="ts" module>
	export type FieldAs = 'input' | 'textarea' | 'select';
	let nextId = 0;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type {
		HTMLInputAttributes,
		HTMLTextareaAttributes,
		HTMLSelectAttributes
	} from 'svelte/elements';

	type Props = {
		label: string;
		as?: FieldAs;
		hint?: string;
		error?: string;
		id?: string;
		value?: string | number;
		name?: string;
		type?: string;
		required?: boolean;
		autocomplete?: string;
		minlength?: number;
		maxlength?: number;
		placeholder?: string;
		rows?: number;
		min?: number;
		max?: number;
		disabled?: boolean;
		options?: Snippet;
	} & Omit<HTMLInputAttributes & HTMLTextareaAttributes & HTMLSelectAttributes, 'id' | 'name' | 'value' | 'type'>;

	let {
		label,
		as = 'input',
		hint,
		error,
		id,
		value = $bindable(''),
		name,
		type = 'text',
		required,
		autocomplete,
		minlength,
		maxlength,
		placeholder,
		rows,
		min,
		max,
		disabled,
		options,
		...rest
	}: Props = $props();

	const generatedId = `field-${++nextId}`;
	const fieldId = $derived(id ?? generatedId);
	const hintId = $derived(hint ? `${fieldId}-hint` : undefined);
	const errorId = $derived(error ? `${fieldId}-error` : undefined);
	const describedBy = $derived(
		[hintId, errorId].filter(Boolean).join(' ') || undefined
	);
</script>

<div class="field" class:has-error={!!error}>
	<label for={fieldId}>{label}</label>
	{#if as === 'textarea'}
		<textarea
			id={fieldId}
			{name}
			{required}
			{autocomplete}
			{minlength}
			{maxlength}
			{placeholder}
			{rows}
			{disabled}
			aria-describedby={describedBy}
			aria-invalid={error ? 'true' : undefined}
			bind:value
			{...rest}
		></textarea>
	{:else if as === 'select'}
		<select
			id={fieldId}
			{name}
			{required}
			{disabled}
			aria-describedby={describedBy}
			aria-invalid={error ? 'true' : undefined}
			bind:value
			{...rest}
		>
			{#if options}{@render options()}{/if}
		</select>
	{:else}
		<input
			id={fieldId}
			{name}
			{type}
			{required}
			{autocomplete}
			{minlength}
			{maxlength}
			{placeholder}
			{min}
			{max}
			{disabled}
			aria-describedby={describedBy}
			aria-invalid={error ? 'true' : undefined}
			bind:value
			{...rest}
		/>
	{/if}
	{#if hint}<small id={hintId} class="hint">{hint}</small>{/if}
	{#if error}<small id={errorId} class="error" role="alert">{error}</small>{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	label {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-fg-70);
	}
	input,
	textarea,
	select {
		background: transparent;
		color: var(--color-fg);
		border: 0;
		border-bottom: 1px solid var(--color-fg-15);
		border-radius: 0;
		padding: 8px 0;
		font-family: var(--font-mono);
		font-size: 13px;
		outline: none;
	}
	textarea {
		resize: vertical;
		min-height: 90px;
	}
	input:focus,
	textarea:focus,
	select:focus {
		border-bottom-color: var(--color-fg);
	}
	.has-error input,
	.has-error textarea,
	.has-error select {
		border-bottom-color: #ff8b8b;
	}
	.hint {
		font-size: 11px;
		color: var(--color-fg-50);
	}
	.error {
		font-size: 11px;
		color: #ff8b8b;
	}
</style>
