<!--
	Signal de découverte (docs/04 §7) : réfutations restées sans réponse.
	Règle publique et automatique, sans choix éditorial ni popularité.
-->
<script lang="ts">
	import { href } from '#lib/href.js';
	import Pager from '#lib/components/Pager.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { categoryLabel, formatDay } from '#lib/i18n.js';
	import AuthorHandle from '#lib/components/AuthorHandle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{m.disc_title()} · Maieutik</title>
</svelte:head>

<main class="page">
	<h1>
		{m.disc_title()}{#if data.category}
			· {categoryLabel(data.category)}{/if}
	</h1>
	<p class="intro">{m.disc_intro()}</p>

	{#if data.items.length === 0}
		<p class="muted">{m.disc_empty()}</p>
	{:else}
		<ol class="list">
			{#each data.items as r (r.id)}
				<li lang={r.lang}>
					<h2><a href={href(`/textes/${r.id}`)}>{r.title ?? m.text_untitled()}</a></h2>
					<p class="meta">
						<AuthorHandle author={r.author} />
						{m.disc_refutes()}
						<a href={href(`/textes/${r.target.id}`)}>« {r.target.title ?? m.text_untitled()} »</a>
						({m.text_by()}
						<AuthorHandle author={r.target.author} />) ·
						<time datetime={r.publishedOn}>{formatDay(r.publishedOn)}</time>
						· {categoryLabel(r.category)}
					</p>
				</li>
			{/each}
		</ol>
	{/if}
	<Pager page={data.page} hasNext={data.hasNext} />
</main>

<style>
	.intro,
	.muted {
		color: var(--muted);
	}
	.list {
		list-style: none;
		padding: 0;
	}
	.list li {
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0;
		font-size: var(--text-lg);
	}
	h2 a {
		text-decoration: none;
	}
	.meta {
		margin: var(--space-1) 0 0;
		font-size: var(--text-sm);
		color: var(--muted);
	}
</style>
