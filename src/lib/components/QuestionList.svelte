<script lang="ts">
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import { categoryLabel, formatDay, langLabel } from '#lib/i18n.js';
	import type { QuestionSummary } from '#lib/server/repository.js';
	import AuthorHandle from './AuthorHandle.svelte';

	let { questions, showCategory = true }: { questions: QuestionSummary[]; showCategory?: boolean } =
		$props();
</script>

{#if questions.length === 0}
	<p class="empty">{m.q_empty()}</p>
{:else}
	<ul class="questions">
		{#each questions as q (q.id)}
			<li lang={q.lang}>
				<h3><a href={href(`/questions/${q.id}`)}>{q.title}</a></h3>
				<p class="meta">
					{m.q_positions({ count: q.positions })}
					{#if q.unansweredRefutations > 0}
						· <strong>{m.q_unanswered({ count: q.unansweredRefutations })}</strong>
					{/if}
					· {m.q_asked_by()}
					<AuthorHandle author={q.author} />
					<time datetime={q.createdOn}>{m.q_asked_on({ date: formatDay(q.createdOn) })}</time>
					{#if showCategory}· {categoryLabel(q.category)}{/if}
					· {langLabel(q.lang)}
				</p>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.questions {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.questions li {
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--line);
	}
	h3 {
		margin: 0;
		font-size: var(--text-lg);
	}
	h3 a {
		text-decoration: none;
	}
	h3 a:hover {
		text-decoration: underline;
	}
	.meta {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.empty {
		color: var(--muted);
	}
</style>
