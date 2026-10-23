<!--
	Vue « positions en présence » (docs/04 §4) : chaque position, ce qui la soutient,
	ce qui la conteste, et les réfutations restées sans réponse. Aucun classement par popularité :
	les positions apparaissent dans l'ordre où elles ont été publiées, et le fil de discussion
	de chacune dans l'ordre des publications aussi.
-->
<script lang="ts">
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import { categoryLabel, formatDay, kindLabel, relationGroupLabel } from '#lib/i18n.js';
	import AuthorHandle from '#lib/components/AuthorHandle.svelte';
	import QuestionReport from '#lib/components/QuestionReport.svelte';
	import RelationMark from '#lib/components/RelationMark.svelte';
	import type { ThreadNode } from '#lib/server/repository.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const q = $derived(data.question);
	const SUPPORT = ['complements', 'provides-evidence', 'reinterprets', 'replies-to'] as const;
	/** En dessous de ce nombre de textes, le fil est déplié d'emblée ; au-delà, replié. */
	const OPEN_BELOW = 7;
</script>

<svelte:head>
	<title>{q.title} · Maieutik</title>
</svelte:head>

<!-- Une branche du fil : chaque réponse avec la nature de sa relation, puis ses propres réponses. -->
{#snippet branch(nodes: ThreadNode[])}
	<ul>
		{#each nodes as node (node.id)}
			<li lang={node.lang}>
				<p>
					{#if node.relationKind}<RelationMark kind={node.relationKind} />{/if}
					<a href={href(`/textes/${node.id}`)}>{node.title ?? m.text_untitled()}</a>
					<span class="by"><AuthorHandle author={node.author} /></span>
					{#if node.relationKind === 'refutes' && node.replies === 0}
						<strong class="alert-text">{m.q_unanswered_badge()}</strong>
					{/if}
				</p>
				{#if node.children.length > 0}{@render branch(node.children)}{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<main class="page" lang={q.lang}>
	<nav class="crumbs">
		<a href={href('/questions')}>{m.q_title()}</a>
		<span aria-hidden="true">›</span>
		<a href={href(`/questions?discipline=${q.category}`)}>{categoryLabel(q.category)}</a>
	</nav>
	<h1>{q.title}</h1>
	<p class="meta">
		{m.q_asked_by()}
		<AuthorHandle author={q.author} />
		<time datetime={q.createdOn}>{m.q_asked_on({ date: formatDay(q.createdOn) })}</time>
	</p>
	{#if q.context}
		<p class="context">{q.context}</p>
	{/if}

	<p><a class="button" href={href(`/ecrire?question=${q.id}`)}>{m.q_add_position()}</a></p>

	<h2>{m.q_view_title()}</h2>
	{#if q.positions.length === 0}
		<p class="muted">{m.q_no_positions()}</p>
	{:else}
		<ol class="positions">
			{#each q.positions as position (position.id)}
				{@const unanswered = position.refutations.filter((r) => !r.answered).length}
				<li>
					<p class="kind">
						{kindLabel(position.kind)}
						{#if SUPPORT.some((k) => (position.counts[k] ?? 0) > 0)}
							<span class="tag ok">{m.q_defended()}</span>
						{/if}
						{#if (position.counts.refutes ?? 0) > 0}
							<span class="tag">{m.q_contested()}</span>
						{/if}
						{#if unanswered > 0}
							<span class="tag alert">{m.q_unanswered({ count: unanswered })}</span>
						{/if}
					</p>
					<h3>
						<a href={href(`/textes/${position.id}`)}>{position.title ?? m.text_untitled()}</a>
					</h3>
					<p class="meta">
						{m.text_by()}
						<AuthorHandle author={position.author} /> ·
						<time datetime={position.publishedOn}>{formatDay(position.publishedOn)}</time>
					</p>
					{#if position.intro}<p class="intro">{position.intro}</p>{/if}
					<ul class="counts">
						{#each ['refutes', ...SUPPORT] as const as kind (kind)}
							{#if (position.counts[kind] ?? 0) > 0}
								<li>
									<RelationMark
										{kind}
										label={`${relationGroupLabel(kind)} : ${position.counts[kind]}`}
									/>
								</li>
							{/if}
						{/each}
					</ul>
					{#if position.thread.length > 0}
						<details class="thread" open={position.threadSize < OPEN_BELOW}>
							<summary>
								{m.q_thread()} <span class="muted">({position.threadSize})</span>
							</summary>
							{@render branch(position.thread)}
						</details>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
	<QuestionReport questionId={q.id} />
</main>

<style>
	.crumbs {
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.crumbs a {
		text-decoration: none;
	}
	.meta,
	.muted {
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.context {
		max-width: var(--measure);
		white-space: pre-line;
		font-family: var(--font-reading);
		font-size: var(--text-read);
	}
	.positions {
		list-style: none;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: var(--space-4);
	}
	.positions > li {
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--line);
		border-top: 3px solid var(--ink);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.kind {
		margin: 0;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: 600;
	}
	.tag {
		margin-left: var(--space-1);
		padding: 0 var(--space-2);
		border: 1px solid var(--line);
		border-radius: var(--r-pill);
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
	}
	.tag.alert,
	.alert-text {
		border-color: var(--rel-refutes);
		color: var(--rel-refutes);
	}
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: var(--text-lg);
	}
	h3 a {
		text-decoration: none;
	}
	/* Début de la position : deux lignes, pour juger d'un coup d'œil de quoi elle parle. */
	.intro {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		margin: var(--space-2) 0 0;
		font-size: var(--text-sm);
	}
	.counts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}

	/* Fil de discussion : la hiérarchie des réponses se lit à l'indentation et au trait. */
	.thread {
		margin-top: var(--space-3);
		padding-top: var(--space-2);
		border-top: 1px solid var(--line);
		font-size: var(--text-sm);
	}
	.thread summary {
		cursor: pointer;
		font-weight: 600;
	}
	.thread ul {
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}
	.thread ul ul {
		margin-left: var(--space-2);
		padding-left: var(--space-3);
		border-left: 2px solid var(--line);
	}
	.thread li {
		margin: var(--space-2) 0;
	}
	.thread li > p {
		margin: 0;
	}
	.thread a {
		text-underline-offset: 0.15em;
	}
	.by {
		color: var(--muted);
	}
	.alert-text {
		margin-left: var(--space-1);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
</style>
