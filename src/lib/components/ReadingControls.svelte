<!--
	Réglages de confort de lecture : taille du texte, largeur de colonne, interligne et thème.
	Utilisé dans le menu « Aa » d'un texte et dans /preferences. Chaque choix s'applique tout de
	suite et reste dans ce navigateur ; sans JavaScript, le composant n'est pas affiché.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { setTheme, theme, type ThemeChoice } from '#lib/client/theme.svelte.js';
	import {
		DEFAULT_VIEW,
		initView,
		resetView,
		setView,
		view,
		type Leading,
		type Measure,
		type TextSize
	} from '#lib/client/reading-view.svelte.js';

	let { id }: { id: string } = $props();

	// Relit les réglages posés sur <html> par static/theme-init.js.
	onMount(initView);

	const sizes: [TextSize, () => string][] = [
		['s', m.read_size_s],
		['m', m.read_size_m],
		['l', m.read_size_l],
		['xl', m.read_size_xl]
	];
	const measures: [Measure, () => string][] = [
		['narrow', m.read_measure_narrow],
		['normal', m.read_measure_normal],
		['wide', m.read_measure_wide]
	];
	const leadings: [Leading, () => string][] = [
		['tight', m.read_leading_tight],
		['normal', m.read_leading_normal],
		['loose', m.read_leading_loose]
	];
	const themes: [ThemeChoice, () => string][] = [
		['auto', m.prefs_theme_auto],
		['light', m.prefs_theme_light],
		['sepia', m.prefs_theme_sepia],
		['dark', m.prefs_theme_dark]
	];

	// Les glyphes « A » grandissent avec la taille du texte qu'ils représentent.
	const glyphSize: Record<TextSize, string> = {
		s: '0.8rem',
		m: '1rem',
		l: '1.2rem',
		xl: '1.45rem'
	};

	const isDefault = $derived(
		view.size === DEFAULT_VIEW.size &&
			view.measure === DEFAULT_VIEW.measure &&
			view.leading === DEFAULT_VIEW.leading
	);
	// Réglage du thème : valable une fois le thème lu par le layout.
	const themeReady = $derived(theme.current !== null);
</script>

<div class="controls">
	<fieldset>
		<legend>{m.read_size()}</legend>
		<div class="segments sizes">
			{#each sizes as [value, label] (value)}
				<label class:on={view.size === value} title={label()}>
					<input
						type="radio"
						name="{id}-size"
						{value}
						checked={view.size === value}
						onchange={() => setView('size', value)}
					/>
					<span aria-hidden="true" style:font-size={glyphSize[value]}>A</span>
					<span class="visually-hidden">{label()}</span>
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset>
		<legend>{m.read_measure()}</legend>
		<div class="segments">
			{#each measures as [value, label] (value)}
				<label class:on={view.measure === value}>
					<input
						type="radio"
						name="{id}-measure"
						{value}
						checked={view.measure === value}
						onchange={() => setView('measure', value)}
					/>
					{label()}
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset>
		<legend>{m.read_leading()}</legend>
		<div class="segments">
			{#each leadings as [value, label] (value)}
				<label class:on={view.leading === value}>
					<input
						type="radio"
						name="{id}-leading"
						{value}
						checked={view.leading === value}
						onchange={() => setView('leading', value)}
					/>
					{label()}
				</label>
			{/each}
		</div>
	</fieldset>

	{#if themeReady}
		<fieldset>
			<legend>{m.prefs_theme_title()}</legend>
			<div class="segments">
				{#each themes as [value, label] (value)}
					<label class:on={theme.choice === value}>
						<input
							type="radio"
							name="{id}-theme"
							{value}
							checked={theme.choice === value}
							onchange={() => setTheme(value)}
						/>
						{label()}
					</label>
				{/each}
			</div>
		</fieldset>
	{/if}

	<button type="button" class="reset" onclick={resetView} disabled={isDefault}>
		{m.read_reset()}
	</button>
</div>

<style>
	.controls {
		min-width: 19rem;
		max-width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-2);
	}
	fieldset {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		padding: 0;
		margin-bottom: var(--space-1);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.segments {
		display: flex;
		border: 1px solid var(--field-line);
		border-radius: var(--r-pill);
		overflow: hidden;
	}
	label {
		position: relative;
		flex: 1;
		display: grid;
		place-items: center;
		min-height: 2.5rem;
		padding: 0 var(--space-3);
		font-size: var(--text-sm);
		text-align: center;
		cursor: pointer;
		transition:
			background-color var(--ease),
			color var(--ease);
	}
	label + label {
		border-left: 1px solid var(--field-line);
	}
	label:hover:not(.on) {
		background: var(--paper);
	}
	label.on {
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
	}
	/* Le bouton radio reste réel (clavier, lecteurs d'écran) mais invisible ; le focus se voit sur le segment. */
	input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	label:has(input:focus-visible) {
		outline: 2px solid var(--link);
		outline-offset: -2px;
	}
	.sizes span[aria-hidden] {
		font-family: var(--font-reading);
		line-height: 1;
	}
	.reset {
		align-self: flex-start;
		padding: var(--space-2) 0;
		border: 0;
		background: none;
		color: var(--ink);
		font-size: var(--text-sm);
		text-decoration: underline;
		text-underline-offset: 0.15em;
		cursor: pointer;
	}
	.reset:disabled {
		color: var(--muted);
		text-decoration: none;
	}
</style>
