/**
 * Le script static/theme-init.js (exécuté avant le premier affichage) garde sa propre liste de
 * valeurs acceptées : elle doit rester celle de reading-view.svelte.ts, sinon un réglage
 * enregistré serait ignoré au chargement.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW, LEADINGS, MEASURES, TEXT_SIZES } from './reading-view.svelte';

const script = readFileSync(new URL('../../../static/theme-init.js', import.meta.url), 'utf8');

/** Valeurs acceptées par le script pour un réglage, d'après son objet `allowed`. */
function accepted(field: string): string[] {
	const start = script.indexOf(`${field}: [`);
	if (start < 0) throw new Error(`Réglage absent de theme-init.js : ${field}`);
	const list = script.slice(script.indexOf('[', start) + 1, script.indexOf(']', start));
	return list.split(',').map((value) => value.trim().replaceAll("'", ''));
}

describe('réglages de lecture et theme-init.js', () => {
	it.each([
		['size', TEXT_SIZES],
		['measure', MEASURES],
		['leading', LEADINGS]
	] as const)('%s : toutes les valeurs non défaut sont acceptées', (field, choices) => {
		const expected = choices.filter((value) => value !== DEFAULT_VIEW[field]);
		expect(accepted(field).sort()).toEqual([...expected].sort());
	});
});
