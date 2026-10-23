<script lang="ts">
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import { categoryLabel } from '#lib/i18n.js';
	import { TAXONOMY, type CategoryId } from '#lib/shared/content.js';
	import TextList from '#lib/components/TextList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(`/disciplines/${data.category}`);
	const query = (params: Record<string, string | number>) =>
		'?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
	const sortParam = $derived(data.sort === 'recent' ? 'chronologique' : 'activite');
</script>

<svelte:head>
	<title>{categoryLabel(data.category)} · Maieutik</title>
</svelte:head>

<main class="page">
	<nav class="crumbs" aria-label={m.nav_breadcrumb()}>
		<a href={href('/disciplines')}>{m.nav_explore()}</a>
		{#if data.category !== data.top}
			<span aria-hidden="true">›</span>
			<a href={href(`/disciplines/${data.top}`)}>{categoryLabel(data.top)}</a>
		{/if}
	</nav>
	<h1>{categoryLabel(data.category)}</h1>

	<ul class="subs">
		<li>
			<a
				href={href(`/disciplines/${data.top}`)}
				aria-current={data.category === data.top ? 'page' : undefined}
				>{m.list_all_of({ category: categoryLabel(data.top) })}</a
			>
		</li>
		{#each TAXONOMY[data.top as CategoryId] as sub (sub)}
			{@const id = `${data.top}/${sub}`}
			<li>
				<a
					href={href(`/disciplines/${id}`)}
					aria-current={data.category === id ? 'page' : undefined}>{categoryLabel(id)}</a
				>
			</li>
		{/each}
	</ul>

	<p class="signals">
		<a href={href(`/questions?discipline=${data.category}`)}>{m.nav_questions()}</a>
		·
		<a href={href(`/a-repondre?discipline=${data.category}`)}>{m.nav_to_answer()}</a>
	</p>

	<p class="sort">
		{m.list_sort()} :
		<a
			href={href(base + query({ tri: 'activite' }))}
			aria-current={data.sort === 'activity' ? 'true' : undefined}>{m.list_sort_activity()}</a
		>
		·
		<a
			href={href(base + query({ tri: 'chronologique' }))}
			aria-current={data.sort === 'recent' ? 'true' : undefined}>{m.list_sort_recent()}</a
		>
	</p>

	<TextList texts={data.texts} showCategory={data.category === data.top} />

	<nav class="pager">
		{#if data.page > 1}
			<a href={href(base + query({ tri: sortParam, page: data.page - 1 }))}>← {m.list_previous()}</a
			>
		{/if}
		{#if data.hasNext}
			<a href={href(base + query({ tri: sortParam, page: data.page + 1 }))}>{m.list_next()} →</a>
		{/if}
	</nav>
</main>

<style>
	.crumbs {
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.crumbs a {
		text-decoration: none;
	}
	.subs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: 0;
		list-style: none;
	}
	.subs a {
		display: inline-block;
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--field-line);
		border-radius: var(--r-pill);
		font-size: var(--text-sm);
		text-decoration: none;
	}
	.subs a[aria-current='page'] {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}
	.signals {
		font-size: var(--text-sm);
	}
	.sort {
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.sort a[aria-current='true'] {
		color: var(--ink);
		font-weight: 600;
		text-decoration: none;
	}
	.pager {
		display: flex;
		justify-content: space-between;
		margin-top: var(--space-5);
	}
</style>
