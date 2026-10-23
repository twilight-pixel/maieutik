<script lang="ts">
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import { categoryLabel, langLabel } from '#lib/i18n.js';
	import { CATEGORY_IDS, LANGS, TAXONOMY } from '#lib/shared/content.js';
	import TextList from '#lib/components/TextList.svelte';
	import Pager from '#lib/components/Pager.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>
		{data.results ? m.search_results_for({ query: data.query }) : m.nav_explore()} · Maieutik
	</title>
</svelte:head>

<main class="page">
	<header class="intro">
		<h1>{m.nav_explore()}</h1>
		<p class="lead">{m.disciplines_lead()}</p>
		<form method="get" role="search">
			<label class="visually-hidden" for="q">{m.search_label()}</label>
			<input
				id="q"
				name="q"
				type="search"
				value={data.query}
				placeholder={m.search_label()}
				maxlength="200"
			/>
			<label class="lang">
				<span class="visually-hidden">{m.search_lang()}</span>
				<select name="langue" value={data.lang ?? ''} aria-label={m.search_lang()}>
					<option value="">{m.search_lang_all()}</option>
					{#each LANGS as l (l)}<option value={l}>{langLabel(l)}</option>{/each}
				</select>
			</label>
			<button class="button">{m.search_submit()}</button>
		</form>
		<p class="hint">{m.search_hint()}</p>
	</header>

	{#if data.results}
		<section class="results" aria-labelledby="results-title">
			<h2 id="results-title">{m.search_results_for({ query: data.query })}</h2>
			<p><a href={href('/disciplines')}>← {m.search_clear()}</a></p>
			<TextList texts={data.results} empty={m.search_empty()} />
			<Pager page={data.page} hasNext={data.hasNext} />
		</section>
	{:else}
		<nav class="tops" aria-label={m.nav_categories()}>
			<ul>
				{#each CATEGORY_IDS as category (category)}
					<li><a href={href(`/disciplines/${category}`)}>{categoryLabel(category)}</a></li>
				{/each}
			</ul>
		</nav>

		<!-- Repliées par défaut ; <details> fonctionne sans JavaScript. -->
		<details class="disciplines">
			<summary>{m.disciplines_subs()}</summary>
			<div class="sections">
				{#each CATEGORY_IDS as category (category)}
					<section class="discipline" aria-labelledby={`h-${category}`}>
						<div class="head">
							<h2 id={`h-${category}`}>
								<a href={href(`/disciplines/${category}`)}>{categoryLabel(category)}</a>
							</h2>
							<p class="count">{m.disciplines_count({ count: TAXONOMY[category].length })}</p>
							<a class="all" href={href(`/disciplines/${category}`)}>{m.disciplines_see_all()} →</a>
						</div>
						<ul class="subs">
							{#each TAXONOMY[category] as sub (sub)}
								<li>
									<a href={href(`/disciplines/${category}/${sub}`)}
										>{categoryLabel(`${category}/${sub}`)}</a
									>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		</details>

		<section class="feed" aria-labelledby="feed-title">
			<h2 id="feed-title">{m.list_sort_activity()}</h2>
			<TextList texts={data.feed ?? []} />
			<nav class="pager">
				{#if data.page > 1}
					<a href={href(`/disciplines?page=${data.page - 1}`)}>← {m.list_previous()}</a>
				{/if}
				{#if data.hasNext}
					<a href={href(`/disciplines?page=${data.page + 1}`)}>{m.list_next()} →</a>
				{/if}
			</nav>
		</section>
	{/if}
</main>

<style>
	.intro {
		padding-bottom: var(--space-4);
	}
	.lead {
		margin: 0;
		max-width: 38rem;
		color: var(--muted);
	}
	form {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		max-width: 38rem;
		margin-top: var(--space-5);
	}
	.lang select {
		height: 100%;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--r-pill);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	input {
		flex: 1 1 14rem;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--r-pill);
	}
	.hint {
		margin: var(--space-2) 0 0;
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.results,
	.feed {
		padding-top: var(--space-5);
	}
	.results h2,
	.feed h2 {
		margin: 0 0 var(--space-1);
		font-size: var(--text-xl);
	}
	.pager {
		display: flex;
		justify-content: space-between;
		margin-top: var(--space-5);
	}

	.tops ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0 0 var(--space-4);
		padding: 0;
		list-style: none;
	}
	.tops a {
		display: block;
		padding: var(--space-1) var(--space-4);
		border: 1px solid var(--field-line);
		border-radius: var(--r-pill);
		font-size: var(--text-sm);
		text-decoration: none;
	}
	.tops a:hover {
		border-color: var(--ink);
	}

	.disciplines {
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	summary {
		padding: var(--space-4) 0;
		font-family: var(--font-reading);
		font-weight: 650;
		font-size: var(--text-lg);
		cursor: pointer;
	}
	summary:hover {
		text-decoration: underline;
	}

	.discipline {
		display: grid;
		grid-template-columns: minmax(12rem, 18rem) 1fr;
		gap: var(--space-4) var(--space-7);
		padding: var(--space-5) 0;
		border-top: 1px solid var(--line);
	}
	.discipline h2 {
		margin: 0;
		font-size: var(--text-xl);
		letter-spacing: -0.01em;
	}
	.discipline h2 a {
		text-decoration: none;
	}
	.discipline h2 a:hover {
		text-decoration: underline;
	}
	.count {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.all {
		display: inline-block;
		margin-top: var(--space-3);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
	}
	.all:hover {
		text-decoration: underline;
	}

	.subs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
		align-content: start;
	}
	.subs a {
		display: block;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		text-decoration: none;
	}
	.subs a:hover {
		border-color: var(--ink);
	}

	@media (max-width: 48rem) {
		.discipline {
			grid-template-columns: 1fr;
			padding: var(--space-5) 0;
		}
	}
</style>
