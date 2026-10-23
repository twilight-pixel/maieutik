<!--
	Actions sur un texte. Elles signent un contenu dans le navigateur : rien ne s'affiche
	sans JavaScript, la lecture reste complète.
-->
<script lang="ts">
	import { href } from '#lib/href.js';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';
	import { reportCategoryLabel } from '#lib/i18n.js';
	import { identity } from '#lib/client/identity.svelte.js';
	import { REPORT_CATEGORIES, validateReport } from '#lib/shared/payloads.js';
	import type { TextView } from '#lib/server/repository.js';

	let { text }: { text: TextView } = $props();

	let mounted = $state(false);
	let category = $state<(typeof REPORT_CATEGORIES)[number]>('other-illegal');
	let passage = $state('');
	let justification = $state('');
	let reportOpen = $state(false);
	let error = $state('');
	let notice = $state('');
	let busy = $state(false);

	const replyKinds = [
		['complements', m.act_complement()],
		['provides-evidence', m.act_evidence()],
		['reinterprets', m.act_reinterpret()],
		['refutes', m.act_refute()],
		['replies-to', m.act_reply()],
		['translation-of', m.act_translate()]
	] as const;

	const isAuthor = $derived(identity.active?.publicKey === text.author.key);
	const readable = $derived(text.status === 'published' && text.payload !== null);

	onMount(() => {
		mounted = true;
		identity.init();
	});

	async function withdraw() {
		if (!confirm(m.act_withdraw_confirm())) return;
		busy = true;
		error = '';
		try {
			await identity.submit('/api/withdrawals', 'text-withdrawal', { textId: text.id });
			await invalidateAll();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	async function report(event: SubmitEvent) {
		event.preventDefault();
		const payload = {
			reportId: crypto.randomUUID(),
			textId: text.id,
			version: text.version,
			category,
			passage: passage.trim(),
			justification: justification.trim()
		};
		const check = validateReport(payload);
		if (!check.ok) {
			error = check.error;
			return;
		}
		busy = true;
		error = '';
		try {
			await identity.submit('/api/reports', 'report', payload);
			notice = m.act_report_sent();
			reportOpen = false;
			passage = '';
			justification = '';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

{#if mounted && identity.status !== 'loading'}
	<aside class="actions">
		{#if identity.active}
			<p class="as">
				{m.act_as()} <strong>{identity.active.displayName}</strong><span class="fp"
					>#{identity.active.fingerprint}</span
				>
			</p>
			{#if readable}
				<p class="respond">{m.act_respond_as()}</p>
				<div class="row">
					{#each replyKinds as [kind, label] (kind)}
						<!-- Tous les gestes ont le même poids : on n'invite pas d'abord à contredire. -->
						<a class="button secondary" href={href(`/ecrire?reponse=${text.id}&relation=${kind}`)}
							>{label}</a
						>
					{/each}
				</div>
			{/if}
			<div class="row">
				{#if isAuthor && readable}
					<a class="button secondary" href={href(`/ecrire?texte=${text.id}`)}
						>{m.act_new_version()}</a
					>
				{/if}
				{#if isAuthor && (text.status === 'published' || text.status === 'under_review')}
					<button class="button secondary" onclick={withdraw} disabled={busy}
						>{m.act_withdraw()}</button
					>
				{/if}
			</div>
			{#if !isAuthor && text.payload}
				<details bind:open={reportOpen}>
					<summary>{m.act_report()}</summary>
					<form onsubmit={report}>
						<p class="muted">{m.act_report_intro()}</p>
						<label>
							{m.act_report_category()}
							<select bind:value={category}>
								{#each REPORT_CATEGORIES as c (c)}<option value={c}>{reportCategoryLabel(c)}</option
									>{/each}
							</select>
						</label>
						<label>
							{m.act_report_passage()}
							<textarea bind:value={passage} rows="3" maxlength="1000" required></textarea>
						</label>
						<label>
							{m.act_report_justification()}
							<textarea bind:value={justification} rows="3" maxlength="2000" required></textarea>
						</label>
						<button class="button" disabled={busy}>{m.act_report_submit()}</button>
					</form>
				</details>
			{/if}
		{:else}
			<p class="muted">
				{m.id_need_identity()} <a href={href('/identite')}>{m.id_go_identity()}</a>
			</p>
		{/if}
		{#if notice}<p class="notice" role="status">{notice}</p>{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</aside>
{/if}

<style>
	.actions {
		margin-top: var(--space-6);
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.as {
		margin: 0 0 var(--space-3);
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.fp {
		font-family: var(--font-mono);
	}
	.respond {
		margin: 0 0 var(--space-2);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.row + .row {
		margin-top: var(--space-3);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	details {
		margin-top: var(--space-4);
	}
	summary {
		cursor: pointer;
		font-size: var(--text-sm);
		color: var(--muted);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-top: var(--space-3);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: var(--text-sm);
		font-weight: 600;
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
