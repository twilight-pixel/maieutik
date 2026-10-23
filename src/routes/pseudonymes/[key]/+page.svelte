<!-- Page « œuvre » d'un pseudonyme (docs/04 §9) : ni abonnés ni réputation, seulement l'âge. -->
<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDay } from '#lib/i18n.js';
	import TextList from '#lib/components/TextList.svelte';
	import Pager from '#lib/components/Pager.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const p = $derived(data.pseudonym);
</script>

<svelte:head>
	<title>{p.displayName}#{p.fingerprint} · Maieutik</title>
</svelte:head>

<main class="page">
	<BackLink to="/disciplines" />
	<h1>{p.displayName}<span class="fp">#{p.fingerprint}</span></h1>
	<p class="meta">
		<time datetime={p.createdOn}>{m.author_since({ date: formatDay(p.createdOn) })}</time>
		{#if p.isTeam}· {m.text_team()}{/if}
	</p>
	{#if p.movedTo}
		<p class="moved">
			{m.author_moved_to()}
			<a href={href(`/pseudonymes/${p.movedTo.key}`)}
				>{p.movedTo.displayName}<span class="fp">#{p.movedTo.fingerprint}</span></a
			>
		</p>
	{:else if p.moved}<p class="meta">{m.author_moved()}</p>{/if}
	{#if p.previous.length > 0}
		<p class="meta">
			{m.author_previous()} :
			{#each p.previous as old, i (old.key)}
				{#if i > 0},{/if}
				<a href={href(`/pseudonymes/${old.key}`)}
					>{old.displayName}<span class="fp">#{old.fingerprint}</span></a
				>
			{/each}
		</p>
	{/if}

	<h2>{m.author_works()}</h2>
	<TextList texts={data.items} empty={m.author_empty()} />
	<Pager page={data.page} hasNext={data.hasNext} />

	<p class="export">
		<a href={href(`/pseudonymes/${p.key}/export.json`)} download>{m.author_export()}</a>
	</p>
</main>

<style>
	.fp {
		font-family: var(--font-mono);
		font-weight: 400;
		font-size: 0.6em;
		color: var(--muted);
	}
	.meta {
		color: var(--muted);
	}
	.moved {
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--ink);
		background: var(--surface);
	}
	.export {
		margin-top: var(--space-6);
		font-size: var(--text-sm);
	}
</style>
