<!--
	Formule LaTeX rendue par KaTeX (D17). C'est le seul composant autorisé à injecter du HTML :
	la sortie de KaTeX, jamais un texte de l'utilisateur. Les garde-fous (src/lib/math.ts) :
	- `trust: false` (pas de \href, \url, \includegraphics, \htmlClass…) ;
	- `maxExpand` et `maxSize` bornent les macros récursives et les tailles démesurées ;
	- une formule invalide est affichée en texte brut, sans HTML.
	Rendu côté serveur : la lecture fonctionne sans JavaScript. Polices et feuille de style de
	KaTeX sont servies par la plateforme elle-même (aucune ressource tierce).
-->
<script lang="ts">
	import katex from 'katex';
	import 'katex/dist/katex.min.css';
	import { KATEX_OPTIONS } from '#lib/math.js';

	let { latex, display = false }: { latex: string; display?: boolean } = $props();

	const html = $derived.by(() => {
		try {
			return katex.renderToString(latex, { ...KATEX_OPTIONS, displayMode: display });
		} catch {
			return null;
		}
	});
</script>

<!-- Exception relue : voir l'en-tête (D17). Semgrep : nosemgrep devant chaque {@html}. -->
<!-- eslint-disable svelte/no-at-html-tags -->
{#if html === null}
	<code class="math-error">{latex}</code>
{:else if display}
	<div class="math-block">
		<!-- nosemgrep: maieutik-no-raw-html-svelte -->
		{@html html}
	</div>
{:else}
	<!-- nosemgrep: maieutik-no-raw-html-svelte -->
	{@html html}
{/if}

<style>
	.math-block {
		overflow-x: auto;
		overflow-y: hidden;
		margin: var(--space-4) 0;
	}
</style>
