<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { href } from '#lib/href.js';
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { JSONContent } from '@tiptap/core';
	import { deLocalizeHref, getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import {
		categoryLabel,
		formatDay,
		kindLabel,
		langLabel,
		relationLabel,
		warningLabel
	} from '#lib/i18n.js';
	import { identity } from '#lib/client/identity.svelte.js';
	import { deleteDraft, isBlank, loadDraft, saveDraft, type Draft } from '#lib/client/draft.js';
	import Editor from '#lib/components/Editor.svelte';
	import AuthorHandle from '#lib/components/AuthorHandle.svelte';
	import {
		CATEGORY_IDS,
		CONTENT_WARNINGS,
		LANGS,
		RELATION_KINDS,
		TAXONOMY,
		TEXT_KINDS
	} from '#lib/shared/content.js';
	import type { ContentWarning, Lang, RelationKind, TextKind } from '#lib/shared/content.js';
	import { normalizeDocument, type DocNode } from '#lib/shared/blocks.js';
	import {
		normalizeTags,
		normalizeWarnings,
		validateTextVersion,
		type Source,
		type TextVersionPayload
	} from '#lib/shared/payloads.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Valeurs initiales du formulaire, lues une fois (le chargement ne change pas sur cette page).
	const initial = untrack(() => data);
	const base = initial.base;
	const target = initial.target;
	const otherLang = (l: Lang): Lang => (l === 'fr' ? 'en' : 'fr');

	type SourceDraft = {
		title: string;
		author: string;
		date: string;
		publisher: string;
		url: string;
	};
	const toDraft = (s: Source): SourceDraft => ({
		title: s.title,
		author: s.author ?? '',
		date: s.date ?? '',
		publisher: s.publisher ?? '',
		url: s.url ?? ''
	});

	const initialRelation: RelationKind = initial.relation ?? 'replies-to';
	let relation = $state<RelationKind>(initialRelation);
	let title = $state(base?.title ?? '');
	let category = $state(base?.category ?? target?.category ?? initial.question?.category ?? '');
	let kind = $state<TextKind>(
		base?.kind ??
			(initialRelation === 'translation-of'
				? (target?.kind ?? 'essay')
				: target
					? 'critique'
					: 'essay')
	);
	let lang = $state<Lang>(
		base?.lang ??
			(target
				? initialRelation === 'translation-of'
					? otherLang(target.lang)
					: target.lang
				: (initial.question?.lang ?? (getLocale() as Lang)))
	);
	let tags = $state(base?.tags.join(', ') ?? '');
	let warnings = $state<ContentWarning[]>(base?.warnings ?? []);
	let sources = $state<SourceDraft[]>((base?.sources ?? target?.sources ?? []).map(toDraft));
	let deferred = $state(false);
	let body: JSONContent | null = null;
	// Contenu de départ de l'éditeur ; remplacé par le brouillon retrouvé, s'il y en a un.
	let initialBody = $state<DocNode | null>(base?.body ?? target?.body ?? null);

	let mounted = $state(false);
	let busy = $state(false);
	let error = $state('');
	let notice = $state('');

	// --- Brouillon local (src/lib/client/draft.ts) ---
	// Un brouillon par contexte : nouveau texte, réponse à tel texte, version de tel texte…
	const draftContext = base
		? `version:${base.textId}`
		: target
			? `reply:${target.id}`
			: initial.question
				? `position:${initial.question.id}`
				: 'new';

	function snapshot(): Draft {
		return {
			title,
			category,
			kind,
			lang,
			tags,
			warnings: [...warnings],
			sources: $state.snapshot(sources),
			deferred,
			relation,
			body
		};
	}

	// Valeurs de départ, pour « Repartir de zéro ».
	const startValues = untrack(() => ({ ...snapshot(), body: null }));
	let draftRestored = $state(false);
	/** `saved` : enregistré ici ; `unavailable` : le navigateur refuse de stocker le brouillon. */
	let draftState = $state<'none' | 'saved' | 'unavailable'>('none');
	/** Incrémenté pour recréer l'éditeur avec un nouveau contenu de départ. */
	let editorKey = $state(0);
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let dirty = false;
	let published = false;

	function saveNow() {
		clearTimeout(saveTimer);
		dirty = false;
		if (published) return;
		const draft = snapshot();
		const stored = saveDraft(draftContext, draft);
		draftState = isBlank(draft) ? 'none' : stored ? 'saved' : 'unavailable';
	}

	function scheduleSave() {
		if (published || !mounted) return;
		dirty = true;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(saveNow, 1500);
	}

	function applyDraft(draft: Draft) {
		title = draft.title;
		tags = draft.tags;
		warnings = draft.warnings.filter((w): w is ContentWarning =>
			(CONTENT_WARNINGS as readonly string[]).includes(w)
		);
		sources = draft.sources;
		deferred = draft.deferred;
		// Une nouvelle version garde la discipline, le type et la langue du texte publié.
		if (!base) {
			category = draft.category;
			if ((TEXT_KINDS as readonly string[]).includes(draft.kind)) kind = draft.kind as TextKind;
			if ((LANGS as readonly string[]).includes(draft.lang)) lang = draft.lang as Lang;
		}
		if (target && (RELATION_KINDS as readonly string[]).includes(draft.relation)) {
			relation = draft.relation as RelationKind;
		}
		initialBody = (draft.body as DocNode | null) ?? initialBody;
	}

	function discardDraft() {
		clearTimeout(saveTimer);
		dirty = false;
		deleteDraft(draftContext);
		title = startValues.title;
		category = startValues.category;
		kind = startValues.kind as TextKind;
		lang = startValues.lang as Lang;
		tags = startValues.tags;
		warnings = startValues.warnings as ContentWarning[];
		sources = startValues.sources;
		deferred = startValues.deferred;
		relation = startValues.relation as RelationKind;
		initialBody = base?.body ?? target?.body ?? null;
		body = null;
		draftRestored = false;
		draftState = 'none';
		editorKey++;
	}

	// Chaque modification des champs planifie un enregistrement ; le premier passage (valeurs de
	// départ) n'en demande pas, pour ne pas fabriquer un brouillon d'un formulaire intact.
	let firstPass = true;
	$effect(() => {
		void [title, category, kind, lang, tags, deferred, relation, warnings.length];
		void JSON.stringify(sources);
		if (firstPass) {
			firstPass = false;
			return;
		}
		untrack(scheduleSave);
	});

	// L'éditeur appelle `onchange` une première fois à sa création : ce n'est pas une saisie.
	let editorReady = false;
	function onBody(doc: JSONContent) {
		body = doc;
		if (editorReady) scheduleSave();
		editorReady = true;
	}

	function flush() {
		if (dirty) saveNow();
	}

	/** Seul cas où le navigateur doit retenir l'auteur : un texte qu'on ne sait pas garder. */
	function onBeforeUnload(event: BeforeUnloadEvent) {
		flush();
		if (draftState === 'unavailable' && !published) event.preventDefault();
	}

	// Pas de pseudonyme au moment de signer : on garde le brouillon et on propose d'en créer un.
	let needIdentity = $state(false);
	const identityHref = $derived(
		href(
			`/identite?retour=${encodeURIComponent(deLocalizeHref(page.url.pathname + page.url.search))}`
		)
	);

	const heading = $derived(
		data.mode === 'version'
			? m.ed_title_version()
			: data.mode === 'reply'
				? m.ed_title_reply()
				: data.mode === 'position'
					? m.q_add_position()
					: m.ed_title_new()
	);

	onMount(() => {
		// Brouillon enregistré sur cet appareil : restauré avant l'affichage du formulaire.
		const saved = loadDraft(draftContext);
		if (saved) {
			applyDraft(saved);
			draftRestored = true;
			draftState = 'saved';
		}
		mounted = true;
		identity.init();
	});

	const optional = (value: string) => (value.trim() === '' ? null : value.trim());

	function buildSources(): Source[] {
		return sources.map((s, i) => ({
			id: `s${i + 1}`,
			title: s.title.trim(),
			author: optional(s.author),
			date: optional(s.date),
			publisher: optional(s.publisher),
			url: optional(s.url)
		}));
	}

	/** Retire les paragraphes vides en fin de texte : l'éditeur en garde un après un bloc. */
	function trimTrailing(doc: JSONContent | null): JSONContent | null {
		if (!doc?.content) return doc;
		const content = [...doc.content];
		while (content.length > 1) {
			const last = content[content.length - 1];
			if (last.type !== 'paragraph' || last.content?.length) break;
			content.pop();
		}
		return { ...doc, content };
	}

	async function publish(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		let doc;
		try {
			doc = normalizeDocument(trimTrailing(body));
		} catch {
			error = m.ed_empty();
			return;
		}
		const payload: TextVersionPayload = {
			textId: base?.textId ?? crypto.randomUUID(),
			version: base ? base.version + 1 : 1,
			category,
			lang,
			kind,
			title: title.trim(),
			body: doc,
			tags: normalizeTags(tags.split(',')),
			warnings: normalizeWarnings(warnings),
			relation: base ? base.relation : target ? { kind: relation, target: target.id } : null,
			question: base ? base.question : (initial.question?.id ?? null),
			sources: buildSources(),
			deferred: base ? false : deferred
		};
		const check = validateTextVersion(payload);
		if (!check.ok) {
			error = check.error === 'catégorie inconnue' ? m.ed_choose_category() : check.error;
			return;
		}
		if (target && relation === 'translation-of' && lang === target.lang) {
			error = m.ed_translation_lang();
			return;
		}
		// Pas de pseudonyme : le texte est prêt, on le garde et on propose d'en créer un pour le signer.
		if (!identity.active) {
			saveNow();
			needIdentity = true;
			return;
		}
		busy = true;
		try {
			const result = (await identity.submit('/api/texts', 'text-version', payload)) as {
				publishedOn: string;
				deferred: boolean;
			};
			// Publié : le brouillon n'a plus lieu d'être.
			published = true;
			clearTimeout(saveTimer);
			deleteDraft(draftContext);
			if (result.deferred) {
				notice = m.ed_published_deferred({ date: formatDay(result.publishedOn) });
			} else {
				await goto(href(`/textes/${payload.textId}`));
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:window onpagehide={flush} onbeforeunload={onBeforeUnload} />

<svelte:head>
	<title>{heading} · Maieutik</title>
</svelte:head>

<main class="page">
	<BackLink
		to={target
			? `/textes/${target.id}`
			: data.question
				? `/questions/${data.question.id}`
				: '/disciplines'}
	/>
	<h1>{heading}</h1>

	<noscript><p class="callout">{m.id_js_required()}</p></noscript>

	{#if target}
		<p class="context">
			<strong>{relationLabel(relation)}</strong>
			<a href={href(`/textes/${target.id}`)}>« {target.title} »</a>
			{m.text_by()}
			<AuthorHandle author={target.author} />
		</p>
	{/if}
	{#if data.question}
		<p class="context">
			{m.ed_question_for()}
			<a href={href(`/questions/${data.question.id}`)}>« {data.question.title} »</a>
		</p>
	{/if}

	{#if !mounted || (data.mode === 'version' && identity.status === 'loading')}
		<p class="muted">{m.id_loading()}</p>
	{:else if data.mode === 'version' && !identity.active}
		<p class="callout">
			{m.id_need_identity()} <a href={href('/identite')}>{m.id_go_identity()}</a>
		</p>
	{:else if data.mode === 'version' && identity.active?.publicKey !== data.author}
		<p class="callout">{m.id_need_identity()}</p>
	{:else if notice}
		<p class="callout" role="status">{notice}</p>
	{:else}
		<form onsubmit={publish}>
			<div class="writing">
				{#if draftRestored}
					<p class="restored" role="status">
						{m.ed_draft_restored()}
						<button type="button" class="link" onclick={discardDraft}>
							{base ? m.ed_draft_discard_version() : m.ed_draft_discard()}
						</button>
					</p>
				{/if}
				{#if target}
					<label class="relation">
						{m.ed_relation()}
						<select bind:value={relation}>
							{#each RELATION_KINDS as r (r)}<option value={r}>{relationLabel(r)}</option>{/each}
						</select>
					</label>
				{/if}

				<input
					class="title"
					bind:value={title}
					maxlength="200"
					required
					aria-label={m.ed_title()}
					placeholder={m.ed_title_placeholder()}
				/>

				{#key editorKey}
					<Editor
						initial={initialBody}
						label={m.ed_body()}
						sourceCount={sources.length}
						onchange={onBody}
					/>
				{/key}

				<section class="sources" aria-labelledby="sources-title">
					<h2 id="sources-title">{m.ed_sources()}</h2>
					<p class="muted">{m.ed_sources_hint()}</p>
					{#if sources.length === 0}
						<p class="empty">{m.ed_sources_empty()}</p>
					{/if}
					{#each sources as source, i (i)}
						<div class="source">
							<div class="source-head">
								<span class="source-number">[{i + 1}]</span>
								{#if i === sources.length - 1}
									<button type="button" class="link" onclick={() => sources.pop()}
										>{m.ed_source_remove()}</button
									>
								{/if}
							</div>
							<label class="wide">
								{m.ed_source_title()}
								<input bind:value={source.title} maxlength="300" required />
							</label>
							<label>
								{m.ed_source_author()}
								<input bind:value={source.author} maxlength="300" />
							</label>
							<label>
								{m.ed_source_date()}
								<input bind:value={source.date} maxlength="10" />
							</label>
							<label>
								{m.ed_source_publisher()}
								<input bind:value={source.publisher} maxlength="300" />
							</label>
							<label>
								{m.ed_source_url()}
								<input type="url" bind:value={source.url} maxlength="2000" />
							</label>
						</div>
					{/each}
					{#if sources.length < 50}
						<button
							type="button"
							class="button secondary"
							onclick={() =>
								sources.push({ title: '', author: '', date: '', publisher: '', url: '' })}
							>{m.ed_source_add()}</button
						>
					{/if}
				</section>
			</div>

			<aside class="settings" aria-labelledby="settings-title">
				<h2 id="settings-title">{m.ed_settings()}</h2>
				<p class="muted as">
					{#if identity.active}
						{m.act_as()} <strong>{identity.active.displayName}</strong>#{identity.active
							.fingerprint}
					{:else}
						{m.ed_anonymous()}
					{/if}
				</p>

				<label>
					{m.ed_category()}
					<select bind:value={category} required disabled={data.mode === 'version'}>
						<option value="" disabled>{m.ed_choose_category()}</option>
						{#each CATEGORY_IDS as c (c)}
							<optgroup label={categoryLabel(c)}>
								<option value={c}>{categoryLabel(c)}</option>
								{#each TAXONOMY[c] as sub (sub)}
									<option value={`${c}/${sub}`}>{categoryLabel(`${c}/${sub}`)}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</label>
				<label>
					{m.ed_kind()}
					<select bind:value={kind} disabled={data.mode === 'version'}>
						{#each TEXT_KINDS as k (k)}<option value={k}>{kindLabel(k)}</option>{/each}
					</select>
				</label>
				{#if kind === 'fact'}<p class="muted note">{m.ed_fact_hint()}</p>{/if}
				<label>
					{m.ed_lang()}
					<select bind:value={lang} disabled={data.mode === 'version'}>
						{#each LANGS as l (l)}<option value={l}>{langLabel(l)}</option>{/each}
					</select>
				</label>
				<label>
					{m.ed_tags()}
					<input bind:value={tags} autocomplete="off" />
				</label>

				<fieldset>
					<legend>{m.ed_warnings()}</legend>
					<p class="muted note">{m.ed_warnings_hint()}</p>
					<div class="checks">
						{#each CONTENT_WARNINGS as w (w)}
							<label class="check"
								><input type="checkbox" value={w} bind:group={warnings} /> {warningLabel(w)}</label
							>
						{/each}
					</div>
				</fieldset>

				{#if data.mode !== 'version'}
					<label class="check">
						<input type="checkbox" bind:checked={deferred} />
						<span
							><strong>{m.ed_deferred()}</strong><br /><span class="muted note"
								>{m.ed_deferred_hint()}</span
							></span
						>
					</label>
				{/if}

				{#if error}<p class="error" role="alert">{error}</p>{/if}
				{#if needIdentity && !identity.active}
					<div class="callout" role="status">
						<p>{m.ed_sign_prompt()}</p>
						<a class="button" href={identityHref}>{m.id_go_identity()}</a>
					</div>
				{/if}
				<button class="button publish" disabled={busy}>{m.ed_publish()}</button>
				{#if draftState !== 'none'}
					<p class="muted note draft-state" class:warn={draftState === 'unavailable'} role="status">
						{draftState === 'saved' ? m.ed_draft_saved() : m.ed_draft_unavailable()}
					</p>
				{/if}
			</aside>
		</form>
	{/if}
</main>

<style>
	h1 {
		margin: 0 0 var(--space-2);
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--muted);
	}
	form {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: var(--space-6);
		align-items: start;
		margin-top: var(--space-4);
	}
	.writing {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		min-width: 0;
	}
	.settings {
		position: sticky;
		top: 1rem;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-4);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	h2 {
		margin: 0;
		font-size: var(--text-md);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-weight: 600;
		font-size: var(--text-sm);
	}
	.title {
		padding: var(--space-2) 0;
		border: 0;
		border-bottom: 2px solid var(--field-line);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font-family: var(--font-reading);
		font-size: clamp(1.5rem, 4vw, 2rem);
		font-weight: 650;
		line-height: 1.25;
	}
	.title::placeholder {
		color: var(--muted);
		opacity: 0.7;
	}
	.title:focus {
		border-bottom-color: var(--ink);
		outline: none;
	}
	.restored {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-left: 3px solid var(--accent);
		background: var(--surface);
		font-size: var(--text-sm);
	}
	.restored .link {
		margin-left: var(--space-2);
		font-weight: 600;
	}
	.draft-state {
		margin: 0;
		text-align: center;
	}
	.draft-state.warn {
		color: var(--danger);
	}
	.callout p {
		margin: 0 0 var(--space-2);
	}
	.relation {
		flex-direction: row;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		padding: 0;
		margin-bottom: var(--space-1);
		font-weight: 600;
		font-size: var(--text-sm);
	}
	.checks {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.check {
		flex-direction: row;
		align-items: flex-start;
		gap: var(--space-2);
		font-weight: 400;
	}
	.muted {
		color: var(--muted);
		font-weight: 400;
		margin: 0;
	}
	.note {
		font-size: var(--text-sm);
		line-height: 1.45;
	}
	.as {
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}
	.callout {
		padding: var(--space-4) var(--space-5);
		border-left: 3px solid var(--ink);
		background: var(--surface);
	}
	.context {
		margin: var(--space-1) 0;
		padding: var(--space-2) var(--space-4);
		border-left: 3px solid var(--line);
		color: var(--muted);
	}
	.sources {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.empty {
		margin: 0;
		padding: var(--space-4) var(--space-4);
		width: 100%;
		border: 1px dashed var(--line);
		border-radius: var(--radius);
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.source {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2) var(--space-3);
		width: 100%;
		padding: var(--space-4) var(--space-4);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.source-head,
	.wide {
		grid-column: 1 / -1;
	}
	.source-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.source-number {
		font-family: var(--font-mono);
		font-weight: 600;
	}
	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--danger);
		font: inherit;
		font-size: var(--text-sm);
		text-decoration: underline;
		cursor: pointer;
	}
	.publish {
		justify-content: center;
		width: 100%;
	}
	.error {
		color: var(--danger);
		margin: 0;
	}
	@media (max-width: 52rem) {
		form {
			grid-template-columns: minmax(0, 1fr);
		}
		.settings {
			position: static;
		}
	}
	@media (max-width: 40rem) {
		.source {
			grid-template-columns: 1fr;
		}
	}
</style>
