<script lang="ts">
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import { categoryLabel } from '#lib/i18n.js';
	import QuestionList from '#lib/components/QuestionList.svelte';
	import Pager from '#lib/components/Pager.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const sorts = [
		['recent', 'recentes', m.q_sort_recent],
		['contested', 'contradictoires', m.q_sort_contested],
		['unanswered', 'sans-reponse', m.q_sort_unanswered]
	] as const;
	const sortHref = (param: string) =>
		href(
			'/questions?' +
				new URLSearchParams({
					tri: param,
					...(data.category ? { discipline: data.category } : {})
				}).toString()
		);
</script>

<svelte:head>
	<title>{m.q_title()} · Maieutik</title>
</svelte:head>

<main class="page">
	<h1>
		{m.q_title()}{#if data.category}
			· {categoryLabel(data.category)}{/if}
	</h1>
	<p class="intro">{m.q_intro()}</p>
	<p><a class="button" href={href('/questions/nouvelle')}>{m.q_new()}</a></p>
	<p class="sort">
		{m.q_sort()} :
		{#each sorts as [value, param, label], i (value)}
			{#if i > 0}<span class="sep" aria-hidden="true">·</span>{/if}
			<a href={sortHref(param)} aria-current={data.sort === value ? 'true' : undefined}>{label()}</a
			>
		{/each}
	</p>
	<QuestionList questions={data.items} showCategory={!data.category} />
	<Pager page={data.page} hasNext={data.hasNext} />
</main>

<style>
	.sort {
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.sep {
		margin-inline: 0.4em;
	}
	.sort a[aria-current='true'] {
		color: var(--ink);
		font-weight: 600;
		text-decoration: none;
	}
	.intro {
		color: var(--muted);
		max-width: 46rem;
	}
</style>
