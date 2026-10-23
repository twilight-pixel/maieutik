<!--
	Instantané textuel d'une source citée (docs/04 §5). Seul du texte brut est affiché :
	aucune ressource de la page d'origine n'est chargée.
-->
<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDay } from '#lib/i18n.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const s = $derived(data.snapshot);
</script>

<svelte:head>
	<title>{m.snap_title()} · Maieutik</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="page">
	<BackLink to="/disciplines" />
	<h1>{s.title ?? m.snap_title()}</h1>
	<p class="intro">{m.snap_intro()}</p>
	<dl>
		<dt>{m.snap_original()}</dt>
		<dd><a href={s.url} rel="external noopener noreferrer nofollow">{s.url}</a></dd>
		{#if s.archivedOn}
			<dt>{m.snap_title()}</dt>
			<dd><time datetime={s.archivedOn}>{formatDay(s.archivedOn)}</time> · {s.contentType}</dd>
		{/if}
		{#if s.sha256}
			<dt>{m.snap_hash()}</dt>
			<dd><code>{s.sha256}</code></dd>
		{/if}
	</dl>
	{#if s.text}
		<pre class="text">{s.text}</pre>
	{:else}
		<p class="muted">{m.snap_no_text()}</p>
	{/if}
</main>

<style>
	.intro,
	.muted {
		color: var(--muted);
	}
	dl {
		font-size: var(--text-sm);
	}
	dt {
		font-weight: 600;
		margin-top: var(--space-2);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.text {
		margin-top: var(--space-5);
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		white-space: pre-wrap;
		font-family: var(--font-serif);
		font-size: var(--text-md);
		line-height: 1.6;
	}
</style>
