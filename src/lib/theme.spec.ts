/**
 * Les trois thèmes de src/app.css doivent rester lisibles : contraste du texte ≥ 4,5:1 (WCAG AA),
 * des bordures de champs et du texte sur bouton plein ≥ 3:1. Le test lit les jetons dans la
 * feuille de style, il n'y a donc pas de seconde copie des couleurs à tenir à jour.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');

/** Jetons de couleur d'un bloc dont le sélecteur est exactement `selector`. */
function tokens(selector: string): Record<string, string> {
	const start = css.indexOf(`${selector} {`);
	if (start < 0) throw new Error(`Bloc introuvable : ${selector}`);
	const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start));
	return Object.fromEntries(
		[...body.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/g)].map(([, name, value]) => [name, value])
	);
}

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5]
		.map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}

const themes = {
	clair: tokens(':root'),
	sépia: tokens(":root[data-theme='sepia']"),
	sombre: tokens(":root[data-theme='dark']")
};

describe.each(Object.entries(themes))('thème %s', (_name, t) => {
	it.each([
		['ink', 'paper'],
		['ink', 'surface'],
		['ink', 'field'],
		['muted', 'paper'],
		['muted', 'surface'],
		['link', 'paper'],
		['link', 'surface'],
		['danger', 'paper'],
		['danger', 'surface'],
		['accent-ink', 'accent'],
		...['refutes', 'complements', 'evidence', 'reinterprets', 'replies', 'translation'].flatMap(
			(relation) => [
				[`rel-${relation}`, 'paper'],
				[`rel-${relation}`, 'surface']
			]
		)
	])('texte %s sur %s ≥ 4,5:1', (fg, bg) => {
		expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
	});

	it.each([
		['field-line', 'field'],
		['field-line', 'paper']
	])('bordure %s sur %s ≥ 3:1', (fg, bg) => {
		expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
	});
});

/** Mélange sRGB de deux couleurs, comme `color-mix(in srgb, a share%, b)`. */
function mix(a: string, b: string, share: number): string {
	const channel = (i: number) =>
		Math.round(
			Number.parseInt(a.slice(i, i + 2), 16) * share +
				Number.parseInt(b.slice(i, i + 2), 16) * (1 - share)
		)
			.toString(16)
			.padStart(2, '0');
	return `#${channel(1)}${channel(3)}${channel(5)}`;
}

describe('contraste renforcé (prefers-contrast: more)', () => {
	it('la feuille de style dérive les jetons de l’encre et du papier', () => {
		const block = css.slice(css.indexOf('@media (prefers-contrast: more)'));
		expect(block).toContain('--muted: color-mix(in srgb, var(--ink) 90%, var(--paper))');
		expect(block).toContain('--line: color-mix(in srgb, var(--ink) 45%, var(--paper))');
	});

	it.each(Object.entries(themes))('thème %s : texte atténué ≥ 7:1, bordures ≥ 3:1', (_name, t) => {
		const muted = mix(t.ink, t.paper, 0.9);
		expect(contrast(muted, t.paper)).toBeGreaterThanOrEqual(7);
		expect(contrast(muted, t.surface)).toBeGreaterThanOrEqual(7);
		expect(contrast(mix(t.ink, t.paper, 0.7), t.field)).toBeGreaterThanOrEqual(3);
	});
});

describe('thème sombre du système', () => {
	it('reprend exactement les valeurs du thème sombre choisi', () => {
		const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
		const system = tokens(':root:not([data-theme])');
		expect(media).toContain(':root:not([data-theme])');
		expect(system).toEqual(themes.sombre);
	});
});
