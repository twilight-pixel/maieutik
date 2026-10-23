<!--
	Lecture d'un texte. Fonctionne sans JavaScript : les avertissements utilisent <details>,
	seules les actions (répondre, signaler, retirer) demandent JS et une identité.
-->
<script lang="ts">
	import BackLink from './BackLink.svelte';
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import {
		categoryLabel,
		formatDay,
		kindLabel,
		langLabel,
		originLabel,
		outcomeLabel,
		relationGroupLabel,
		relationLabel,
		reportCategoryLabel,
		warningLabel
	} from '#lib/i18n.js';
	import { CONTENT_WARNINGS, RELATION_KINDS } from '#lib/shared/content.js';
	import type { TextView } from '#lib/server/repository.js';
	import AuthorHandle from './AuthorHandle.svelte';
	import Blocks from './Blocks.svelte';
	import TextList from './TextList.svelte';
	import TextActions from './TextActions.svelte';
	import AppealForm from './AppealForm.svelte';
	import WarningGate from './WarningGate.svelte';
	import Pager from './Pager.svelte';
	import TextToc from './TextToc.svelte';
	import RelationMark from './RelationMark.svelte';
	import NavMenu from './NavMenu.svelte';
	import ReadingControls from './ReadingControls.svelte';
	import { onMount } from 'svelte';
	import {
		countWords,
		MIN_HEADINGS_FOR_OUTLINE,
		outline,
		readingMinutes
	} from '#lib/shared/reading.js';
	import {
		forgetPosition,
		getPosition,
		RESUME_MIN,
		savePosition
	} from '#lib/client/reading-position.js';

	let { text, latest }: { text: TextView; latest: boolean } = $props();

	const [topCategory] = $derived(text.category.split('/'));
	const warnings = $derived(
		CONTENT_WARNINGS.filter(
			(w) => text.payload?.warnings.includes(w) || text.moderationWarnings.includes(w)
		)
	);
	const title = $derived(text.payload?.title ?? null);

	// Signaux structurels : sources (dont archivées) et réfutations, dont celles sans réponse.
	const archivedSources = $derived(
		text.sources.filter((source) => source.snapshot?.status === 'archived').length
	);
	const refutations = $derived(text.replies.filter((reply) => reply.relationKind === 'refutes'));
	const openRefutations = $derived(refutations.filter((reply) => reply.replies === 0).length);

	// Aides à la lecture d'un texte long : temps de lecture, plan, barre de progression, reprise.
	const minutes = $derived(text.payload ? readingMinutes(countWords(text.payload.body)) : null);
	// Un plan n'a de sens que si le texte est affiché (pas derrière un avertissement).
	const toc = $derived(
		text.payload && warnings.length === 0 && text.status === 'published'
			? outline(text.payload.body)
			: []
	);
	const showToc = $derived(toc.length >= MIN_HEADINGS_FOR_OUTLINE);
	const long = $derived((minutes ?? 0) >= 3);
	const resumable = $derived((minutes ?? 0) >= 5);

	// Le menu « Aa » a besoin de JavaScript : il n'apparaît qu'une fois la page montée.
	let ready = $state(false);
	let bodyEl = $state<HTMLElement>();
	/** Avancement mémorisé sur cet appareil (0 à 1), proposé à la réouverture d'un texte long. */
	let resume = $state<number | null>(null);

	const progress = () => {
		const rect = bodyEl?.getBoundingClientRect();
		if (!rect) return 0;
		const scrollable = rect.height - window.innerHeight;
		return scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;
	};

	function resumeReading() {
		if (!bodyEl || resume === null) return;
		const rect = bodyEl.getBoundingClientRect();
		const top = rect.top + window.scrollY + resume * (rect.height - window.innerHeight);
		window.scrollTo({ top });
		resume = null;
	}

	function restartReading() {
		forgetPosition(text.id);
		resume = null;
	}

	onMount(() => {
		ready = true;
		if (!resumable) return;
		resume = getPosition(text.id);
		let timer: ReturnType<typeof setTimeout> | undefined;
		const onScroll = () => {
			clearTimeout(timer);
			// Pas d'écriture à chaque pixel, et rien tant que l'on n'a pas vraiment avancé :
			// un repère en attente de réponse ne doit pas être effacé par un simple défilement.
			timer = setTimeout(() => {
				const ratio = progress();
				if (ratio >= RESUME_MIN) savePosition(text.id, ratio);
			}, 500);
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			window.removeEventListener('scroll', onScroll);
			clearTimeout(timer);
		};
	});
	// Réponses regroupées par nature de relation, réfutations en tête.
	const groups = $derived(
		(['refutes', 'complements', 'provides-evidence', 'reinterprets', 'replies-to'] as const)
			.filter((kind) => RELATION_KINDS.includes(kind))
			.map((kind) => ({ kind, texts: text.replies.filter((r) => r.relationKind === kind) }))
			.filter((group) => group.texts.length > 0)
	);
</script>

<svelte:head>
	<title>{title ?? m.text_untitled()} · Maieutik</title>
</svelte:head>

<main class="page reading" class:long>
	<BackLink
		to={!latest
			? `/textes/${text.id}`
			: text.relation
				? `/textes/${text.relation.id}`
				: `/disciplines/${text.category}`}
	/>
	<!-- Barre de progression de la lecture : CSS seul (animation liée au défilement), si le navigateur sait. -->
	<div class="progress" aria-hidden="true"></div>
	<article lang={text.lang}>
		{#if showToc}<TextToc items={toc} variant="side" />{/if}
		<nav class="crumbs" aria-label={m.nav_breadcrumb()}>
			<a href={href(`/disciplines/${topCategory}`)}>{categoryLabel(topCategory)}</a>
			{#if text.category.includes('/')}
				<span aria-hidden="true">›</span>
				<a href={href(`/disciplines/${text.category}`)}>{categoryLabel(text.category)}</a>
			{/if}
		</nav>

		<header>
			<div class="head-row">
				<p class="kind">
					{kindLabel(text.kind)} · {langLabel(text.lang)}
					{#if minutes}<span class="read">{m.read_minutes({ minutes })}</span>{/if}
					{#if text.unsourced}
						<span class="badge" title={m.text_unsourced_hint()}>{m.text_unsourced()}</span>
					{/if}
				</p>
				{#if ready}
					<NavMenu label={m.read_aa_label()}>
						{#snippet trigger()}<span class="aa" aria-hidden="true">Aa</span>{/snippet}
						<ReadingControls id="menu" />
					</NavMenu>
				{/if}
			</div>
			<h1>{title ?? m.text_untitled()}</h1>
			<p class="meta">
				{m.text_by()}
				<AuthorHandle author={text.author} /> ·
				<time datetime={text.publishedOn}
					>{m.text_published_on({ date: formatDay(text.publishedOn) })}</time
				>
				{#if text.versions.length > 1 && text.versionOn}
					·
					<a href="#versions"
						>{m.text_version_of({ version: text.version, date: formatDay(text.versionOn) })}</a
					>
				{/if}
			</p>
			<!-- Faits structurels sur le texte (docs/04 §7) : sources et réfutations, sans classement. -->
			{#if text.sources.length > 0 || refutations.length > 0}
				<ul class="signals">
					{#if text.sources.length > 0}
						<li>
							{m.list_sources({ count: text.sources.length })}
							{#if archivedSources > 0}
								<span class="sub">{m.text_signal_archived({ archived: archivedSources })}</span>
							{/if}
						</li>
					{/if}
					{#if refutations.length > 0}
						<li>{relationGroupLabel('refutes')} : {refutations.length}</li>
					{/if}
					{#if openRefutations > 0}
						<li class="open">{m.q_unanswered({ count: openRefutations })}</li>
					{/if}
				</ul>
			{/if}
			{#if text.relation}
				<p class="reply-to">
					<RelationMark kind={text.relation.kind} label={relationLabel(text.relation.kind)} />
					<a href={href(`/textes/${text.relation.id}`)}
						>« {text.relation.title ?? m.text_untitled()} »</a
					>
					{m.text_by()}
					<AuthorHandle author={text.relation.author} />
				</p>
			{/if}
			{#if text.question}
				<p class="reply-to">
					{text.question.isPosition ? m.text_position_of() : m.text_in_discussion()}
					<a href={href(`/questions/${text.question.id}`)}>« {text.question.title} »</a>
				</p>
			{/if}
			{#if text.translations.length > 0}
				<p class="reply-to">
					{m.text_translations()} :
					{#each text.translations as t, i (t.id)}
						{#if i > 0},{/if}
						<a href={href(`/textes/${t.id}`)} hreflang={t.lang} lang={t.lang}
							>{langLabel(t.lang)} — {t.title ?? m.text_untitled()}</a
						>
					{/each}
				</p>
			{/if}
			{#if !latest}
				<p class="notice"><a href={href(`/textes/${text.id}`)}>{m.text_view_current()}</a></p>
			{/if}
		</header>

		{#if showToc}<TextToc items={toc} variant="inline" />{/if}

		{#if resume !== null}
			<p class="resume" role="status">
				{m.read_resume_text({ percent: Math.round(resume * 100) })}
				<button type="button" class="link" onclick={resumeReading}>{m.read_resume_go()}</button>
				<button type="button" class="link" onclick={restartReading}
					>{m.read_resume_dismiss()}</button
				>
			</p>
		{/if}

		{#if text.status === 'withdrawn_by_author'}
			<p class="trace">{m.text_withdrawn()}</p>
		{:else if text.status === 'removed'}
			<p class="trace"><a href={href('/journal')}>{m.text_removed()}</a></p>
		{:else if text.status === 'under_review' || !text.payload}
			<p class="trace">{m.text_under_review()}</p>
		{:else if warnings.length > 0}
			<WarningGate {warnings}>
				<div class="body" bind:this={bodyEl}>
					<Blocks nodes={text.payload.body.content} anchors />
				</div>
			</WarningGate>
		{:else}
			<div class="body" bind:this={bodyEl}>
				<Blocks nodes={text.payload.body.content} anchors />
			</div>
		{/if}

		{#if text.sources.length > 0}
			<section class="sources" aria-labelledby="sources-title">
				<h2 id="sources-title">{m.text_sources()}</h2>
				<ol>
					{#each text.sources as source (source.id)}
						<li id="source-{source.id}">
							{#if source.author}{source.author},{/if}
							<cite>{source.title}</cite>{#if source.publisher}, {source.publisher}{/if}{#if source.date},
								{source.date}{/if}.
							{#if source.url}
								<a href={source.url} rel="external noopener noreferrer nofollow ugc"
									>{new URL(source.url).hostname}</a
								>
								{#if source.snapshot?.status === 'archived' && source.snapshot.archivedOn}
									· <a href={href(`/instantanes?url=${encodeURIComponent(source.url)}`)}
										>{m.text_source_archived({ date: formatDay(source.snapshot.archivedOn) })}</a
									>
								{:else if source.snapshot?.status === 'pending'}
									· <span class="muted">{m.text_source_pending()}</span>
								{:else if source.snapshot}
									· <span class="muted">{m.text_source_failed()}</span>
								{/if}
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		{#if text.payload && text.payload.tags.length > 0}
			<ul class="tags">
				{#each text.payload.tags as tag (tag)}<li>{tag}</li>{/each}
			</ul>
		{/if}
	</article>

	<TextActions {text} />

	<section aria-labelledby="replies">
		<h2 id="replies">{m.text_replies()}</h2>
		{#if groups.length === 0}
			<p class="muted">{m.text_no_replies()}</p>
		{/if}
		{#each groups as group (group.kind)}
			<h3 class="group">
				<RelationMark kind={group.kind} label={relationGroupLabel(group.kind)} />
				<span class="count">{group.texts.length}</span>
			</h3>
			<TextList texts={group.texts} showCategory={false} showRelation={false} />
		{/each}
		<Pager
			page={text.repliesPage}
			hasNext={text.hasMoreReplies}
			param="reponses"
			anchor="replies"
		/>
	</section>

	{#if text.versions.length > 1 || text.envelope}
		<section id="versions" aria-labelledby="versions-title">
			<h2 id="versions-title">{m.text_versions()}</h2>
			<ol class="versions">
				{#each text.versions as v (v.version)}
					<li>
						{#if v.version === text.version}
							<strong>{m.text_version_label({ version: v.version })}</strong>
						{:else}
							<a href={href(`/textes/${text.id}/versions/${v.version}`)}
								>{m.text_version_label({ version: v.version })}</a
							>
						{/if}
						· <time datetime={v.createdOn}>{formatDay(v.createdOn)}</time>
						{#if v.version === text.versions.at(-1)?.version}· {m.text_current_version()}{/if}
					</li>
				{/each}
			</ol>
			{#if text.envelope}
				<p class="signed">
					{m.text_signed()} ·
					<a href={href(`/textes/${text.id}/versions/${text.version}/signe.json`)} download
						>{m.text_signed_download()}</a
					>
				</p>
			{/if}
		</section>
	{/if}

	{#if text.decisions.length > 0}
		<section aria-labelledby="moderation">
			<h2 id="moderation">{m.text_moderation()}</h2>
			<ul class="decisions">
				{#each text.decisions as d (d.id)}
					<li>
						<time datetime={d.decidedOn}>{formatDay(d.decidedOn)}</time> ·
						<strong>{outcomeLabel(d.outcome)}</strong>
						{#if d.warning}({warningLabel(d.warning)}){/if} · {reportCategoryLabel(d.category)} ·
						{originLabel(d.origin)}
						<p>{d.reasoning}</p>
						{#if d.outcome !== 'maintained'}
							<AppealForm decisionId={d.id} authorKey={text.author.key} appealed={d.appealed} />
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>

<style>
	.reading {
		max-width: var(--page-reading);
	}
	article {
		position: relative;
	}
	.progress {
		display: none;
	}
	/* Barre de progression liée au défilement du texte (Chrome, Edge, Safari 26 ; ignorée ailleurs). */
	@supports (animation-timeline: view()) {
		.long {
			timeline-scope: --body;
		}
		.long .body {
			view-timeline: --body block;
		}
		.long .progress {
			display: block;
			position: fixed;
			inset: 0 0 auto;
			z-index: 30;
			height: 3px;
			background: var(--accent);
			transform: scaleX(0);
			transform-origin: left;
			animation: read-progress linear both;
			animation-timeline: --body;
			animation-range: cover 0% cover 100%;
		}
	}
	@keyframes read-progress {
		to {
			transform: scaleX(1);
		}
	}
	.crumbs {
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.crumbs a {
		text-decoration: none;
	}
	header h1 {
		margin: var(--space-1) 0 var(--space-2);
		font-size: clamp(1.8rem, 4vw, 2.6rem);
	}
	.head-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-top: var(--space-3);
	}
	.aa {
		font-family: var(--font-reading);
		font-size: var(--text-sm);
		font-weight: 650;
	}
	.kind {
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: var(--text-xs);
		font-weight: 600;
	}
	.read {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
		color: var(--muted);
	}
	.read::before {
		content: '·';
		margin-inline: var(--space-2);
	}
	.badge {
		margin-left: var(--space-2);
		padding: 0 var(--space-2);
		border: 1px dashed var(--muted);
		border-radius: var(--r-pill);
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
	}
	.meta,
	.reply-to,
	.notice {
		margin: var(--space-1) 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.body {
		margin-top: var(--space-6);
		font-family: var(--font-reading);
		font-size: var(--text-read);
		line-height: var(--reading-leading);
		hyphens: auto;
		text-wrap: pretty;
	}
	.body :global(h2),
	.body :global(h3) {
		scroll-margin-top: var(--space-5);
	}
	/* Liens du texte et des sources : la couleur d'accent des thèmes, en plus du soulignement. */
	.body :global(a),
	.sources a {
		color: var(--link);
	}
	.body :global(blockquote) {
		margin: var(--space-5) 0;
		padding-left: var(--space-4);
		border-left: 3px solid var(--ink);
		color: var(--muted);
	}
	.body :global(pre) {
		overflow-x: auto;
		padding: var(--space-4) var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--line);
		font-size: var(--text-sm);
	}
	.body :global(code) {
		font-family: var(--font-mono);
		font-size: 0.9em;
	}
	.resume {
		margin: var(--space-5) 0 0;
		padding: var(--space-2) var(--space-4);
		border-left: 3px solid var(--accent);
		background: var(--surface);
		font-size: var(--text-sm);
	}
	.resume .link {
		margin-left: var(--space-3);
		padding: var(--space-1) 0;
		border: 0;
		background: none;
		color: var(--ink);
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 0.15em;
		cursor: pointer;
	}
	.trace {
		margin: var(--space-6) 0;
		padding: var(--space-5);
		border: 1px dashed var(--muted);
		border-radius: var(--radius);
		color: var(--muted);
		font-style: italic;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-5) 0 0;
		padding: 0;
		list-style: none;
	}
	.tags li {
		padding: 0.1rem var(--space-2);
		border-radius: var(--r-pill);
		background: var(--surface);
		border: 1px solid var(--line);
		font-size: var(--text-sm);
	}
	section {
		margin-top: var(--space-6);
	}
	section h2 {
		font-size: var(--text-lg);
	}
	.versions,
	.decisions {
		padding-left: var(--space-5);
		font-size: var(--text-sm);
	}
	.sources {
		margin-top: var(--space-6);
		font-size: var(--text-sm);
	}
	.sources h2 {
		font-size: var(--text-lg);
	}
	.sources ol {
		padding-left: var(--space-5);
	}
	.sources li {
		margin: var(--space-1) 0;
	}
	.sources li:target {
		background: var(--surface);
		outline: 1px solid var(--line);
	}
	.muted {
		color: var(--muted);
	}
	.group {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-5) 0 0;
		font-size: var(--text-md);
		font-family: var(--font-sans);
	}
	.group .count {
		color: var(--muted);
		font-size: var(--text-sm);
		font-weight: 400;
	}
	.signals {
		display: flex;
		flex-wrap: wrap;
		margin: var(--space-1) 0;
		padding: 0;
		list-style: none;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.signals li + li::before {
		content: '·';
		margin-inline: 0.45em;
	}
	.signals .sub::before {
		content: '(';
	}
	.signals .sub::after {
		content: ')';
	}
	.signals .open {
		color: var(--rel-refutes);
		font-weight: 600;
	}
	.signed {
		font-size: var(--text-sm);
		color: var(--muted);
	}
</style>
