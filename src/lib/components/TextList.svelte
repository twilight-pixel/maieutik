<script lang="ts">
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import { categoryLabel, formatDay, kindLabel, langLabel } from '#lib/i18n.js';
	import type { TextSummary } from '#lib/server/repository.js';
	import AuthorHandle from './AuthorHandle.svelte';
	import RelationMark from './RelationMark.svelte';

	let {
		texts,
		empty = m.list_empty(),
		showCategory = true,
		showRelation = true
	}: {
		texts: (TextSummary & { excerpt?: string })[];
		empty?: string;
		showCategory?: boolean;
		/** Montre la nature de la relation (réfute, complète…) quand le texte en a une. */
		showRelation?: boolean;
	} = $props();
</script>

{#if texts.length === 0}
	<p class="empty">{empty}</p>
{:else}
	<ol class="texts">
		{#each texts as text (text.id)}
			<li lang={text.lang}>
				{#if showRelation && text.relationKind}<p class="rel">
						<RelationMark kind={text.relationKind} />
					</p>{/if}
				<h3>
					<a href={href(`/textes/${text.id}`)}>{text.title ?? m.text_untitled()}</a>
				</h3>
				<p class="meta">
					<span class="kind">{kindLabel(text.kind)}</span>
					{#if text.unsourced}<span class="badge">{m.text_unsourced()}</span>{/if}
					· {m.text_by()}
					<AuthorHandle author={text.author} />
					· <time datetime={text.publishedOn}>{formatDay(text.publishedOn)}</time>
					{#if showCategory}· {categoryLabel(text.category)}{/if}
					· {langLabel(text.lang)}
				</p>
				<!-- Résultat de recherche : le passage trouvé ; sinon le début du texte. -->
				{#if text.excerpt}
					<p class="excerpt">… {text.excerpt} …</p>
				{:else if text.intro}
					<p class="excerpt intro">{text.intro}</p>
				{/if}
				<!-- Faits sur le texte (docs/04 §7) : jamais de popularité ni de classement. -->
				{#if text.readMinutes || text.sources > 0 || text.replies > 0 || text.openRefutations > 0}
					<ul class="signals">
						{#if text.readMinutes}<li>{m.list_read_minutes({ minutes: text.readMinutes })}</li>{/if}
						{#if text.sources > 0}<li>{m.list_sources({ count: text.sources })}</li>{/if}
						{#if text.replies > 0}<li>{m.list_replies({ count: text.replies })}</li>{/if}
						{#if text.openRefutations > 0}
							<li class="open">{m.q_unanswered({ count: text.openRefutations })}</li>
						{/if}
					</ul>
				{/if}
			</li>
		{/each}
	</ol>
{/if}

<style>
	.texts {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.texts > li {
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
	.rel {
		margin: 0 0 var(--space-1);
	}
	.meta {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.kind {
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--ink);
	}
	.badge {
		margin-left: var(--space-1);
		padding: 0 var(--space-2);
		border: 1px dashed var(--muted);
		border-radius: var(--r-pill);
		font-size: var(--text-xs);
	}
	.excerpt {
		margin: var(--space-2) 0 0;
		font-size: var(--text-sm);
	}
	/* Début du texte : deux lignes au plus, le titre reste l'élément principal. */
	.intro {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		color: var(--ink);
	}
	.signals {
		display: flex;
		flex-wrap: wrap;
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.signals li + li::before {
		content: '·';
		margin-inline: 0.45em;
	}
	.signals .open {
		color: var(--rel-refutes);
		font-weight: 600;
	}
	.empty {
		color: var(--muted);
	}
</style>
