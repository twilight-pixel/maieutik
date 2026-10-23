<!-- Journal public des retraits (docs/05) : décisions motivées, contenu jamais reproduit. -->
<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { href } from '#lib/href.js';
	import Pager from '#lib/components/Pager.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import {
		formatDay,
		originLabel,
		outcomeLabel,
		reportCategoryLabel,
		warningLabel
	} from '#lib/i18n.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{m.log_title()} · Maieutik</title>
</svelte:head>

<main class="page">
	<BackLink to="/disciplines" />
	<h1>{m.log_title()}</h1>
	<p class="intro">{m.log_intro()}</p>

	{#if data.items.length === 0}
		<p class="muted">{m.log_empty()}</p>
	{:else}
		<div class="table">
			<table>
				<thead>
					<tr>
						<th scope="col">{m.log_date()}</th>
						<th scope="col">{m.log_text()}</th>
						<th scope="col">{m.log_category()}</th>
						<th scope="col">{m.log_basis()}</th>
						<th scope="col">{m.log_outcome()}</th>
						<th scope="col">{m.log_origin()}</th>
						<th scope="col">{m.log_reasoning()}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.items as d (d.id)}
						<tr>
							<td><time datetime={d.decidedOn}>{formatDay(d.decidedOn)}</time></td>
							<td>
								{#if d.textId}
									<a href={href(`/textes/${d.textId}`)}>{d.textId.slice(0, 8)}</a>
								{:else if d.questionId}
									{m.text_question()}
									<a href={href(`/questions/${d.questionId}`)}>{d.questionId.slice(0, 8)}</a>
								{/if}
							</td>
							<td>{reportCategoryLabel(d.category)}</td>
							<td>{d.legalBasis}</td>
							<td
								>{outcomeLabel(d.outcome)}{#if d.warning}
									({warningLabel(d.warning)}){/if}</td
							>
							<td>{originLabel(d.origin)}</td>
							<td>{d.reasoning}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	<Pager page={data.page} hasNext={data.hasNext} />
</main>

<style>
	.intro,
	.muted {
		color: var(--muted);
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
		padding: var(--space-2) var(--space-2);
		border-bottom: 1px solid var(--line);
		text-align: left;
		vertical-align: top;
	}
	th {
		font-weight: 600;
		white-space: nowrap;
	}
	td a {
		font-family: var(--font-mono);
	}
</style>
