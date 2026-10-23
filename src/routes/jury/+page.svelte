<!--
	Espace juré (docs/05) : volontariat, jurys en attente, vote à l'aveugle signé.
	Sans session : chaque consultation est une requête signée et horodatée (D14).
-->
<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { onMount } from 'svelte';
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDay, reportCategoryLabel } from '#lib/i18n.js';
	import { identity } from '#lib/client/identity.svelte.js';
	import { markVolunteer, storePending } from '#lib/client/jury-reminder.js';
	import Blocks from '#lib/components/Blocks.svelte';
	import { JURY } from '#lib/shared/jury.js';
	import type { DocNode } from '#lib/shared/blocks.js';
	import { validateJuryVote, type JuryVerdict, type ReportCategory } from '#lib/shared/payloads.js';

	type Assignment = {
		juryId: string;
		deadline: string;
		category: ReportCategory;
		passage: string;
		justification: string;
		textId: string;
		payload: { title: string; body: DocNode } | null;
	};
	type Status = { volunteer: boolean; senior: boolean; eligibleOn: string };

	let mounted = $state(false);
	let status = $state<Status | null>(null);
	let assignments = $state<Assignment[] | null>(null);
	let verdicts = $state<Record<string, JuryVerdict | ''>>({});
	let justifications = $state<Record<string, string>>({});
	let busy = $state(false);
	let error = $state('');
	let notice = $state('');

	onMount(() => {
		mounted = true;
		identity.init();
	});

	async function load() {
		busy = true;
		error = '';
		try {
			const result = (await identity.submit('/api/jury/assignments', 'jury-access', {
				requestedAt: Date.now()
			})) as { status: Status; assignments: Assignment[] };
			status = result.status;
			// Mémorise le volontariat sur cet appareil et le nombre de votes en attente (rappel, D18).
			markVolunteer(identity.active!.publicKey, result.status.volunteer);
			storePending(identity.active!.publicKey, result.assignments.length);
			assignments = result.assignments;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	async function toggleVolunteer() {
		if (!status) return;
		busy = true;
		try {
			await identity.submit('/api/jury/volunteer', 'jury-volunteer', {
				available: !status.volunteer
			});
			status = { ...status, volunteer: !status.volunteer };
			markVolunteer(identity.active!.publicKey, status.volunteer);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	async function vote(assignment: Assignment, event: SubmitEvent) {
		event.preventDefault();
		const payload = {
			juryId: assignment.juryId,
			verdict: verdicts[assignment.juryId],
			justification: (justifications[assignment.juryId] ?? '').trim()
		};
		const check = validateJuryVote(payload);
		if (!check.ok) {
			error = check.error;
			return;
		}
		busy = true;
		error = '';
		try {
			await identity.submit('/api/jury/votes', 'jury-vote', check.value);
			assignments = (assignments ?? []).filter((a) => a.juryId !== assignment.juryId);
			notice = m.jury_voted();
			storePending(identity.active!.publicKey, assignments.length);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{m.jury_mine_title()} · Maieutik</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="page narrow">
	<BackLink to="/identite" />
	<h1>{m.jury_mine_title()}</h1>
	<p class="muted">{m.jury_mine_intro({ age: JURY.minAgeDays })}</p>
	<p><a href={href('/jurys')}>{m.jury_audit_title()}</a></p>

	<noscript><p>{m.id_js_required()}</p></noscript>

	{#if !mounted || identity.status === 'loading'}
		<p class="muted">{m.id_loading()}</p>
	{:else if !identity.active}
		<p>{m.id_need_identity()} <a href={href('/identite')}>{m.id_go_identity()}</a></p>
	{:else}
		<p class="muted">
			{m.act_as()} <strong>{identity.active.displayName}</strong>#{identity.active.fingerprint}
		</p>
		{#if !status}
			<button class="button" onclick={load} disabled={busy}>{m.jury_load()}</button>
		{:else}
			<section class="status">
				{#if status.volunteer}
					<p>{m.jury_is_volunteer()}</p>
				{/if}
				{#if !status.senior}
					<p class="muted">{m.jury_not_senior({ date: formatDay(status.eligibleOn) })}</p>
				{/if}
				<button class="button secondary" onclick={toggleVolunteer} disabled={busy}>
					{status.volunteer ? m.jury_volunteer_off() : m.jury_volunteer()}
				</button>
			</section>

			{#if assignments && assignments.length === 0}
				<p class="muted">{m.jury_no_assignment()}</p>
			{/if}
			{#each assignments ?? [] as a (a.juryId)}
				<form class="assignment" onsubmit={(event) => vote(a, event)}>
					<p class="deadline">{m.jury_deadline({ date: formatDay(a.deadline) })}</p>
					<p class="warning">{m.jury_warning({ category: reportCategoryLabel(a.category) })}</p>
					<p><strong>{m.ref_passage()} :</strong> « {a.passage} »</p>
					<p><strong>{m.ref_justification()} :</strong> {a.justification}</p>
					{#if a.payload}
						<details>
							<summary>{m.jury_show()}</summary>
							<h2>{a.payload.title}</h2>
							<div class="body"><Blocks nodes={a.payload.body.content} /></div>
						</details>
					{/if}
					<fieldset>
						<legend>{m.jury_question()}</legend>
						<label class="check"
							><input type="radio" value="illegal" bind:group={verdicts[a.juryId]} required />
							{m.jury_illegal()}</label
						>
						<label class="check"
							><input type="radio" value="legal" bind:group={verdicts[a.juryId]} />
							{m.jury_legal()}</label
						>
					</fieldset>
					<label>
						{m.jury_justification()}
						<textarea bind:value={justifications[a.juryId]} rows="3" maxlength="2000" required
						></textarea>
					</label>
					<div><button class="button" disabled={busy}>{m.jury_submit()}</button></div>
				</form>
			{/each}
		{/if}
	{/if}

	{#if notice}<p class="notice" role="status">{notice}</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</main>

<style>
	.muted {
		color: var(--muted);
	}
	.status {
		margin: var(--space-4) 0;
	}
	.assignment {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-5);
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.assignment p {
		margin: 0;
	}
	.deadline {
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.warning {
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--danger);
	}
	.body {
		font-family: var(--font-serif);
	}
	fieldset {
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-weight: 600;
		font-size: var(--text-sm);
	}
	.check {
		flex-direction: row;
		align-items: center;
		gap: var(--space-2);
		font-weight: 400;
	}
	textarea {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-weight: 400;
	}
	summary {
		cursor: pointer;
	}
	.notice {
		font-weight: 600;
	}
	.error {
		color: var(--danger);
	}
</style>
