import type { KatexOptions } from 'katex';

/**
 * Réglages de KaTeX communs à la lecture (Math.svelte) et à l'éditeur (D17).
 * `trust: false` interdit \href, \url, \includegraphics, \htmlClass… ; `maxExpand` et `maxSize`
 * bornent les macros récursives et les tailles démesurées.
 */
export const KATEX_OPTIONS: KatexOptions = {
	throwOnError: true,
	trust: false,
	strict: 'ignore',
	maxExpand: 1000,
	maxSize: 20,
	output: 'htmlAndMathml'
};
