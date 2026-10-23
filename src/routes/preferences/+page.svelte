<!--
	Préférences de lecture des avertissements (docs/06) : réglées et conservées dans ce
	navigateur seulement. Sans JavaScript, les contenus avertis restent repliés.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { warningLabel } from '#lib/i18n.js';
	import {
		defaultPrefs,
		loadPrefs,
		savePrefs,
		type ReadingPrefs,
		type WarningMode
	} from '#lib/client/reading-prefs.js';
	import { CONTENT_WARNINGS } from '#lib/shared/content.js';
	import ReadingControls from '#lib/components/ReadingControls.svelte';

	let prefs = $state<ReadingPrefs>(defaultPrefs());
	let mounted = $state(false);
	let saved = $state(false);

	const modes: [WarningMode, () => string][] = [
		['show', m.prefs_show],
		['blur', m.prefs_blur],
		['hide', m.prefs_hide]
	];

	onMount(() => {
		prefs = loadPrefs();
		mounted = true;
	});

	function save(event: SubmitEvent) {
		event.preventDefault();
		saved = savePrefs($state.snapshot(prefs));
	}
</script>

<svelte:head>
	<title>{m.prefs_title()} · Maieutik</title>
</svelte:head>

<main class="page narrow">
	<h1>{m.prefs_title()}</h1>
	<p class="muted">{m.prefs_intro()}</p>
	<noscript><p>{m.id_js_required()}</p></noscript>

	<!-- Les réglages d'affichage s'appliquent tout de suite et se gardent seuls. -->
	{#if mounted}
		<section class="comfort">
			<h2>{m.read_controls_title()}</h2>
			<p class="muted">{m.read_controls_intro()}</p>
			<ReadingControls id="prefs" />
		</section>
	{/if}

	{#if mounted}
		<form onsubmit={save}>
			{#each CONTENT_WARNINGS as warning (warning)}
				<fieldset>
					<legend>{warningLabel(warning)}</legend>
					{#each modes as [mode, label] (mode)}
						<label
							><input
								type="radio"
								value={mode}
								bind:group={prefs[warning]}
								onchange={() => (saved = false)}
							/>
							{label()}</label
						>
					{/each}
				</fieldset>
			{/each}
			<div><button class="button">{m.prefs_save()}</button></div>
			{#if saved}<p class="notice" role="status">{m.prefs_saved()}</p>{/if}
		</form>
	{/if}
</main>

<style>
	.muted {
		color: var(--muted);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	fieldset {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-5);
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}
	legend {
		font-weight: 600;
	}
	.comfort {
		margin-bottom: var(--space-6);
		padding: var(--space-4);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.comfort h2 {
		margin: 0 0 var(--space-1);
		font-size: var(--text-lg);
	}
	.comfort .muted {
		margin: 0 0 var(--space-3);
		font-size: var(--text-sm);
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.notice {
		font-weight: 600;
	}
</style>
