<!-- Signalement d'une question, signé et motivé, traité par le référent (D18). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { reportCategoryLabel } from '#lib/i18n.js';
	import { identity } from '#lib/client/identity.svelte.js';
	import { REPORT_CATEGORIES, validateQuestionReport } from '#lib/shared/payloads.js';

	let { questionId }: { questionId: string } = $props();

	const categories = REPORT_CATEGORIES.filter((c) => c !== 'missing-warning');
	let mounted = $state(false);
	let category = $state<(typeof REPORT_CATEGORIES)[number]>('other-illegal');
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
			reportId: crypto.randomUUID(),
			questionId,
			category,
			justification: justification.trim()
		};
		const check = validateQuestionReport(payload);
		if (!check.ok) {
			error = check.error;
			return;
		}
		busy = true;
		error = '';
		try {
			await identity.submit('/api/question-reports', 'question-report', payload);
			sent = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

{#if sent}
	<p class="notice" role="status">{m.qreport_sent()}</p>
{:else if mounted && identity.active}
	<details>
		<summary>{m.qreport_action()}</summary>
		<form onsubmit={submit}>
			<p class="muted">{m.qreport_intro()}</p>
			<label>
				{m.act_report_category()}
				<select bind:value={category}>
					{#each categories as c (c)}<option value={c}>{reportCategoryLabel(c)}</option>{/each}
				</select>
			</label>
			<label>
				{m.act_report_justification()}
				<textarea bind:value={justification} rows="3" maxlength="2000" required></textarea>
			</label>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div><button class="button secondary" disabled={busy}>{m.act_report_submit()}</button></div>
		</form>
	</details>
{/if}

<style>
	details {
		margin-top: var(--space-6);
	}
	summary {
		cursor: pointer;
		font-size: var(--text-sm);
		color: var(--muted);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-width: 32rem;
		margin-top: var(--space-2);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-weight: 600;
		font-size: var(--text-sm);
	}
	select,
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
		margin: 0;
	}
	.notice {
		font-weight: 600;
	}
	.error {
		color: var(--danger);
	}
</style>
