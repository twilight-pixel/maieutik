<!--
	Recours de l'auteur contre une décision visant son texte (docs/05, garde-fous ; D18).
	Visible seulement pour l'auteur, avec JavaScript : le recours est signé par sa clé.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { identity } from '#lib/client/identity.svelte.js';
	import { validateAppeal } from '#lib/shared/payloads.js';

	let {
		decisionId,
		authorKey,
		appealed
	}: { decisionId: string; authorKey: string; appealed: boolean } = $props();

	let mounted = $state(false);
	let justification = $state('');
	let sent = $state(false);
	let error = $state('');
	let busy = $state(false);

	onMount(() => {
		mounted = true;
		identity.init();
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const payload = {
			appealId: crypto.randomUUID(),
			decisionId,
			justification: justification.trim()
		};
		const check = validateAppeal(payload);
		if (!check.ok) {
			error = check.error;
			return;
		}
		busy = true;
		error = '';
		try {
			await identity.submit('/api/appeals', 'appeal', payload);
			sent = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

{#if appealed || sent}
	<p class="muted">{sent ? m.appeal_sent() : m.appeal_pending()}</p>
{:else if mounted && identity.active?.publicKey === authorKey}
	<details>
		<summary>{m.appeal_action()}</summary>
		<form onsubmit={submit}>
			<p class="muted">{m.appeal_intro()}</p>
			<label>
				{m.appeal_reason()}
				<textarea bind:value={justification} rows="3" maxlength="2000" required></textarea>
			</label>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div><button class="button secondary" disabled={busy}>{m.appeal_submit()}</button></div>
		</form>
	</details>
{/if}

<style>
	details {
		margin-top: var(--space-2);
	}
	summary {
		cursor: pointer;
		font-size: var(--text-sm);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-weight: 600;
		font-size: var(--text-sm);
	}
	textarea {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 400;
	}
	.muted {
		color: var(--muted);
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
	}
	.error {
		color: var(--danger);
	}
</style>
