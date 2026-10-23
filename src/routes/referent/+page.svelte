<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { href } from '#lib/href.js';
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import {
		formatDay,
		originLabel,
		outcomeLabel,
		reportCategoryLabel,
		warningLabel
	} from '#lib/i18n.js';
	import { identity, ApiRequestError } from '#lib/client/identity.svelte.js';
	import { CONTENT_WARNINGS, type ContentWarning } from '#lib/shared/content.js';
	import {
		DECISION_OUTCOMES,
		validateDecision,
		type DecisionOutcome,
		type DecisionPayload,
		type ReportCategory
	} from '#lib/shared/payloads.js';

	type Report = {
		id: string;
		textId: string | null;
		questionId: string | null;
		version: number | null;
		category: ReportCategory;
		passage: string;
		justification: string;
		createdOn: string;
		title: string | null;
		reporter: { closed: number; dismissed: number; reliable: boolean };
	};
	type Appeal = {
		id: string;
		decisionId: string;
		textId: string;
		title: string | null;
		justification: string;
		createdOn: string;
		decision: {
			outcome: DecisionOutcome;
			category: ReportCategory;
			reasoning: string;
			origin: string;
		};
	};
	type Draft = {
		outcome: DecisionOutcome;
		legalBasis: string;
		reasoning: string;
		warning: ContentWarning;
	};

	const QUESTION_OUTCOMES: DecisionOutcome[] = ['maintained', 'removed'];
	const emptyDraft = (): Draft => ({
		outcome: 'maintained',
		legalBasis: '',
		reasoning: '',
		warning: 'other'
	});

	let mounted = $state(false);
	let reports = $state<Report[] | null>(null);
	let appeals = $state<Appeal[]>([]);
	let drafts = $state<Record<string, Draft>>({});
	let invitationCount = $state(5);
	let invitations = $state<string[]>([]);
	let error = $state('');
	let notice = $state('');
	let busy = $state(false);

	onMount(() => {
		mounted = true;
		identity.init();
	});

	async function load() {
		error = '';
		notice = '';
		busy = true;
		try {
			const result = (await identity.submit('/api/referent/reports', 'referent-access', {
				requestedAt: Date.now()
			})) as { reports: Report[]; appeals: Appeal[] };
			reports = result.reports;
			appeals = result.appeals;
			drafts = Object.fromEntries(
				[...result.reports.map((r) => r.id), ...result.appeals.map((a) => a.id)].map((id) => [
					id,
					emptyDraft()
				])
			);
		} catch (e) {
			error =
				e instanceof ApiRequestError && e.message.includes('Réservé')
					? m.ref_forbidden()
					: String(e);
		} finally {
			busy = false;
		}
	}

	async function submitDecision(id: string, payload: DecisionPayload, done: () => void) {
		const check = validateDecision(payload);
		if (!check.ok) {
			error = check.error;
			return;
		}
		busy = true;
		error = '';
		try {
			await identity.submit('/api/decisions', 'moderation-decision', payload);
			done();
			notice = m.ref_done();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	function decide(report: Report, event: SubmitEvent) {
		event.preventDefault();
		const draft = drafts[report.id];
		submitDecision(
			report.id,
			{
				decisionId: crypto.randomUUID(),
				reportId: report.id,
				appealId: null,
				textId: report.textId,
				questionId: report.questionId,
				category: report.category,
				legalBasis: draft.legalBasis.trim(),
				reasoning: draft.reasoning.trim(),
				outcome: draft.outcome,
				warning: draft.outcome === 'warning_added' ? draft.warning : null
			},
			() => (reports = (reports ?? []).filter((r) => r.id !== report.id))
		);
	}

	function decideAppeal(appeal: Appeal, event: SubmitEvent) {
		event.preventDefault();
		const draft = drafts[appeal.id];
		submitDecision(
			appeal.id,
			{
				decisionId: crypto.randomUUID(),
				reportId: null,
				appealId: appeal.id,
				textId: appeal.textId,
				questionId: null,
				category: appeal.decision.category,
				legalBasis: draft.legalBasis.trim(),
				reasoning: draft.reasoning.trim(),
				outcome: draft.outcome,
				warning: draft.outcome === 'warning_added' ? draft.warning : null
			},
			() => (appeals = appeals.filter((a) => a.id !== appeal.id))
		);
	}

	async function createInvitations(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		try {
			const result = (await identity.submit('/api/invitations', 'invitation-create', {
				count: invitationCount,
				requestedAt: Date.now()
			})) as { codes: string[] };
			invitations = result.codes;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{m.ref_title()} · Maieutik</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet decisionFields(id: string, outcomes: readonly DecisionOutcome[])}
	<label>
		{m.ref_outcome()}
		<select bind:value={drafts[id].outcome}>
			{#each outcomes as o (o)}<option value={o}>{outcomeLabel(o)}</option>{/each}
		</select>
	</label>
	{#if drafts[id].outcome === 'warning_added'}
		<label>
			{m.ref_warning()}
			<select bind:value={drafts[id].warning}>
				{#each CONTENT_WARNINGS as w (w)}<option value={w}>{warningLabel(w)}</option>{/each}
			</select>
		</label>
	{/if}
	<label>{m.ref_basis()}<input bind:value={drafts[id].legalBasis} maxlength="300" required /></label
	>
	<label>
		{m.ref_reasoning()}
		<textarea bind:value={drafts[id].reasoning} rows="3" maxlength="4000" required></textarea>
	</label>
	<div><button class="button" disabled={busy}>{m.ref_submit()}</button></div>
{/snippet}

<main class="page">
	<BackLink to="/identite" />
	<h1>{m.ref_title()}</h1>
	<p class="muted">{m.ref_intro()}</p>

	{#if !mounted || identity.status === 'loading'}
		<p class="muted">{m.id_loading()}</p>
	{:else if !identity.active}
		<p>{m.id_need_identity()} <a href={href('/identite')}>{m.id_go_identity()}</a></p>
	{:else}
		<p class="muted">
			{m.act_as()} <strong>{identity.active.displayName}</strong>#{identity.active.fingerprint}
		</p>
		<button class="button" onclick={load} disabled={busy}>{m.ref_load()}</button>
	{/if}

	{#if notice}<p class="notice" role="status">{notice}</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}

	{#if reports}
		{#if reports.length === 0 && appeals.length === 0}
			<p class="muted">{m.ref_empty()}</p>
		{/if}

		{#if appeals.length > 0}
			<h2 class="section">{m.ref_appeals()}</h2>
			{#each appeals as appeal (appeal.id)}
				<form class="report" onsubmit={(event) => decideAppeal(appeal, event)}>
					<h3><a href={href(`/textes/${appeal.textId}`)}>{appeal.title ?? appeal.textId}</a></h3>
					<p class="muted">
						<time datetime={appeal.createdOn}>{formatDay(appeal.createdOn)}</time> ·
						{m.ref_appeal_against()}
						<strong>{outcomeLabel(appeal.decision.outcome)}</strong>
						({originLabel(appeal.decision.origin)}, {reportCategoryLabel(appeal.decision.category)})
					</p>
					<p><strong>{m.log_reasoning()} :</strong> {appeal.decision.reasoning}</p>
					<p><strong>{m.ref_appeal_reason()} :</strong> {appeal.justification}</p>
					{@render decisionFields(appeal.id, DECISION_OUTCOMES)}
				</form>
			{/each}
		{/if}

		{#if reports.length > 0}<h2 class="section">{m.ref_reports()}</h2>{/if}
		{#each reports as report (report.id)}
			<form class="report" onsubmit={(event) => decide(report, event)}>
				<h3>
					{#if report.questionId}
						{m.text_question()} :
						<a href={href(`/questions/${report.questionId}`)}>{report.title ?? report.questionId}</a
						>
					{:else}
						<a href={href(`/textes/${report.textId}/versions/${report.version}`)}
							>{report.title ?? report.textId}</a
						>
					{/if}
				</h3>
				<p class="muted">
					<time datetime={report.createdOn}>{formatDay(report.createdOn)}</time> ·
					<strong>{reportCategoryLabel(report.category)}</strong>
				</p>
				<p class={report.reporter.reliable ? 'muted' : 'alert'}>
					{report.reporter.reliable
						? m.ref_reporter_ok({
								closed: report.reporter.closed,
								dismissed: report.reporter.dismissed
							})
						: m.ref_reporter_unreliable({
								closed: report.reporter.closed,
								dismissed: report.reporter.dismissed
							})}
				</p>
				<p><strong>{m.ref_passage()} :</strong> « {report.passage} »</p>
				<p><strong>{m.ref_justification()} :</strong> {report.justification}</p>
				{@render decisionFields(
					report.id,
					report.questionId ? QUESTION_OUTCOMES : DECISION_OUTCOMES
				)}
			</form>
		{/each}

		<section class="invitations">
			<h2 class="section">{m.ref_invitations()}</h2>
			<p class="muted">{m.ref_invitations_intro()}</p>
			<form onsubmit={createInvitations}>
				<label>
					{m.ref_invitations_count()}
					<input type="number" min="1" max="50" bind:value={invitationCount} required />
				</label>
				<div>
					<button class="button secondary" disabled={busy}>{m.ref_invitations_create()}</button>
				</div>
			</form>
			{#if invitations.length > 0}
				<p class="muted">{m.ref_invitations_once()}</p>
				<ul class="codes">
					{#each invitations as code (code)}<li><code>{code}</code></li>{/each}
				</ul>
			{/if}
		</section>
	{/if}
</main>

<style>
	.muted {
		color: var(--muted);
	}
	.report {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-5);
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.report h3 {
		margin: 0;
		font-size: var(--text-lg);
	}
	.section {
		margin-top: var(--space-6);
		font-size: var(--text-lg);
	}
	.alert {
		color: var(--danger);
	}
	.invitations form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-width: 20rem;
	}
	.codes {
		font-size: var(--text-read);
		line-height: 1.9;
	}
	input,
	select,
	textarea {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-weight: 400;
	}
	.report p {
		margin: 0;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-weight: 600;
		font-size: var(--text-sm);
	}
	.notice {
		font-weight: 600;
	}
	.error {
		color: var(--danger);
	}
</style>
