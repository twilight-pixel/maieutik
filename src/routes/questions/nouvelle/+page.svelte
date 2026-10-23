<!-- Poser une question (contenu signé, docs/04 §4). Demande JavaScript et une identité. -->
<script lang="ts">
	import BackLink from '#lib/components/BackLink.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { href } from '#lib/href.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import { categoryLabel, langLabel } from '#lib/i18n.js';
	import { identity } from '#lib/client/identity.svelte.js';
	import { CATEGORY_IDS, LANGS, TAXONOMY, type Lang } from '#lib/shared/content.js';
	import { validateQuestion } from '#lib/shared/payloads.js';

	let title = $state('');
	let category = $state('');
	let lang = $state<Lang>(getLocale() as Lang);
	let context = $state('');
	let mounted = $state(false);
	let busy = $state(false);
	let error = $state('');

	onMount(() => {
		mounted = true;
		identity.init();
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const payload = {
			questionId: crypto.randomUUID(),
			title: title.trim(),
			category,
			lang,
			context: context.trim()
		};
		const check = validateQuestion(payload);
		if (!check.ok) {
			error = check.error === 'catégorie inconnue' ? m.ed_choose_category() : check.error;
			return;
		}
		busy = true;
		error = '';
		try {
			await identity.submit('/api/questions', 'question', payload);
			await goto(href(`/questions/${payload.questionId}`));
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{m.q_new()} · Maieutik</title>
</svelte:head>

<main class="page">
	<BackLink to="/questions" />
	<h1>{m.q_new()}</h1>
	<noscript><p class="callout">{m.id_js_required()}</p></noscript>

	{#if !mounted || identity.status === 'loading'}
		<p class="muted">{m.id_loading()}</p>
	{:else if !identity.active}
		<p class="callout">
			{m.id_need_identity()} <a href={href('/identite')}>{m.id_go_identity()}</a>
		</p>
	{:else}
		<form onsubmit={submit}>
			<label>
				{m.q_form_title()}
				<input bind:value={title} maxlength="200" required />
				<span class="hint">{m.q_form_title_hint()}</span>
			</label>
			<div class="grid">
				<label>
					{m.ed_category()}
					<select bind:value={category} required>
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
					{m.ed_lang()}
					<select bind:value={lang}>
						{#each LANGS as l (l)}<option value={l}>{langLabel(l)}</option>{/each}
					</select>
				</label>
			</div>
			<label>
				{m.q_form_context()}
				<textarea bind:value={context} rows="5" maxlength="2000"></textarea>
			</label>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div><button class="button" disabled={busy}>{m.q_form_submit()}</button></div>
		</form>
	{/if}
</main>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-weight: 600;
		font-size: var(--text-sm);
	}
	.grid {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: var(--space-3);
	}
	.hint,
	.muted {
		color: var(--muted);
		font-weight: 400;
		font-size: var(--text-sm);
	}
	.callout {
		padding: var(--space-4) var(--space-5);
		border-left: 3px solid var(--ink);
		background: var(--surface);
	}
	.error {
		color: var(--danger);
		margin: 0;
	}
</style>
