<!--
	Transparence des jurys (docs/05, D16) : engagements publiés à l'avance, graines révélées
	le lendemain, vivier et empreinte de chaque tirage. La composition des jurys n'est pas publiée.
-->
<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDay, reportCategoryLabel } from '#lib/i18n.js';
	import { JURY } from '#lib/shared/jury.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const statusLabel = {
		open: m.jury_status_open,
		decided: m.jury_status_decided,
		escalated: m.jury_status_escalated
	};
</script>

<svelte:head>
	<title>{m.jury_audit_title()} · Maieutik</title>
</svelte:head>

<main class="page">
	<BackLink to="/disciplines" />
	<h1>{m.jury_audit_title()}</h1>
	<p class="intro">{m.jury_audit_intro()}</p>
	<p class="intro">
		{m.jury_audit_rules({
			size: JURY.size,
			pool: JURY.minPool,
			age: JURY.minAgeDays,
			days: JURY.deadlineDays,
			quorum: JURY.minVotes
		})}
	</p>

	<h2>{m.jury_list()}</h2>
	{#if data.juries.length === 0}
		<p class="muted">{m.jury_none()}</p>
	{:else}
		<div class="table">
			<table>
				<thead>
					<tr>
						<th scope="col">{m.log_date()}</th>
						<th scope="col">{m.jury_report()}</th>
						<th scope="col">{m.log_category()}</th>
						<th scope="col">{m.jury_pool()}</th>
						<th scope="col">{m.jury_pool_hash()}</th>
						<th scope="col">{m.jury_status()}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.juries as j (j.id)}
						<tr>
							<td><time datetime={j.createdOn}>{formatDay(j.createdOn)}</time></td>
							<td><code>{j.reportId.slice(0, 8)}</code></td>
							<td>{reportCategoryLabel(j.category)}</td>
							<td>{j.eligibleCount}</td>
							<td><code class="hash">{j.eligibleHash}</code></td>
							<td>
								{#if j.outcome === 'illegal'}
									{m.jury_outcome_illegal({
										illegal: j.votesIllegal ?? 0,
										legal: j.votesLegal ?? 0
									})}
								{:else if j.outcome === 'legal'}
									{m.jury_outcome_legal({ illegal: j.votesIllegal ?? 0, legal: j.votesLegal ?? 0 })}
								{:else}
									{statusLabel[j.status]()}
								{/if}
								{#if j.textId}· <a href={href(`/textes/${j.textId}`)}>{m.log_text()}</a>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<h2>{m.jury_seeds()}</h2>
	<div class="table">
		<table>
			<thead>
				<tr>
					<th scope="col">{m.jury_day()}</th>
					<th scope="col">{m.jury_commitment()}</th>
					<th scope="col">{m.jury_seed()}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.seeds as s (s.day)}
					<tr>
						<td><time datetime={s.day}>{formatDay(s.day)}</time></td>
						<td><code class="hash">{s.commitment}</code></td>
						<td>
							{#if s.seed}<code class="hash">{s.seed}</code>{:else}<span class="muted"
									>{m.jury_seed_hidden()}</span
								>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</main>

<style>
	.intro,
	.muted {
		color: var(--muted);
		max-width: 52rem;
	}
	.table {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}
	th,
	td {
		padding: var(--space-2);
		border-bottom: 1px solid var(--line);
		text-align: left;
		vertical-align: top;
	}
	th {
		white-space: nowrap;
	}
	.hash {
		font-size: var(--text-xs);
		overflow-wrap: anywhere;
	}
</style>
