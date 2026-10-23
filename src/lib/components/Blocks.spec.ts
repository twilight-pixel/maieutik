/**
 * Rendu de lecture (serveur) des blocs enrichis : c'est ce que voit un lecteur sans JavaScript.
 */
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { normalizeDocument, type BlockNode } from '#lib/shared/blocks.js';
import Blocks from './Blocks.svelte';

/** HTML rendu, sans marqueurs d'hydratation ni classes de portée de Svelte. */
const html = (...content: unknown[]) => {
	const doc = normalizeDocument({ type: 'doc', content });
	return render(Blocks, { props: { nodes: doc.content as BlockNode[] } })
		.body.replaceAll(/<!--.*?-->/g, '')
		.replaceAll(/ ?svelte-[a-z0-9]+/g, '')
		.replaceAll(' class=""', '');
};
const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const cell = (text: string, type = 'tableCell') => ({ type, content: [para(text)] });

describe('rendu des blocs enrichis', () => {
	it('rend un tableau avec ses en-têtes', () => {
		const out = html({
			type: 'table',
			content: [
				{
					type: 'tableRow',
					content: [cell('Auteur', 'tableHeader'), cell('Thèse', 'tableHeader')]
				},
				{ type: 'tableRow', content: [cell('Platon'), cell('Les idées')] }
			]
		});
		expect(out).toContain('<table>');
		expect(out).toMatch(/<th scope="col"><p>Auteur<\/p><\/th>/);
		expect(out).toMatch(/<td><p>Platon<\/p><\/td>/);
		expect(out).toContain('role="region"');
	});

	it('rend un encadré avec son libellé, et des colonnes', () => {
		const out = html(
			{
				type: 'callout',
				attrs: { variant: 'definition' },
				content: [para('Un terme.')]
			},
			{
				type: 'columns',
				content: [
					{ type: 'column', content: [para('Thèse')] },
					{ type: 'column', content: [para('Réfutation')] }
				]
			}
		);
		expect(out).toContain('callout-definition');
		expect(out).toContain('Définition');
		expect(out).toContain('columns-2');
		expect(out).toContain('Réfutation');
	});

	it('rend une frise comme une liste ordonnée, sans script', () => {
		const out = html({
			type: 'timeline',
			attrs: {
				events: [
					{ date: '1789', title: 'Bastille', text: 'Début' },
					{ date: '1792', title: 'République', text: '' }
				]
			}
		});
		expect(out).toContain('<ol class="timeline');
		expect(out).toContain('1789');
		expect(out).toContain('République');
		expect(out).not.toContain('<script');
	});

	it('rend un schéma en SVG avec sa description textuelle', () => {
		const out = html({
			type: 'diagram',
			attrs: {
				nodes: ['Prémisse', 'Conclusion'],
				edges: [{ from: 0, to: 1, label: 'donc' }]
			}
		});
		expect(out).toContain('<svg');
		expect(out).toContain('role="img"');
		expect(out).toContain('marker-end');
		expect(out).toContain('Prémisse');
		expect(out).toContain('Prémisse → Conclusion : donc');
	});

	it('rend les formules avec KaTeX côté serveur, en bloc et dans une ligne', () => {
		const out = html(
			{ type: 'mathBlock', attrs: { latex: '\\frac{a}{b}' } },
			{
				type: 'paragraph',
				content: [
					{ type: 'text', text: 'Soit ' },
					{ type: 'mathInline', attrs: { latex: 'x^2' } }
				]
			}
		);
		expect(out).toContain('class="katex-display"');
		expect(out).toContain('class="katex"');
		expect(out).toContain('<math');
		expect(out).toContain('Soit ');
	});

	it('affiche une formule invalide en texte brut, sans HTML injecté', () => {
		const bad = '\\unknownmacro{<img src=x onerror=alert(1)>}';
		const out = html({ type: 'mathBlock', attrs: { latex: bad } });
		expect(out).toContain('math-error');
		expect(out).not.toContain('<img');
		expect(out).toContain('&lt;img');
	});

	it('neutralise les commandes dangereuses de KaTeX (trust désactivé)', () => {
		const out = html({
			type: 'mathBlock',
			attrs: {
				latex: '\\href{javascript:alert(1)}{clic} \\htmlClass{x}{y} \\includegraphics{a.png}'
			}
		});
		expect(out).not.toContain('href="javascript');
		expect(out).not.toContain('<img');
		expect(out).not.toMatch(/<a /);
	});

	it('échappe le texte des blocs structurés', () => {
		const out = html(
			{
				type: 'timeline',
				attrs: { events: [{ date: '<b>1</b>', title: '<i>t</i>', text: '' }] }
			},
			{
				type: 'diagram',
				attrs: { nodes: ['<script>x</script>', 'B'], edges: [{ from: 0, to: 1, label: '' }] }
			}
		);
		expect(out).not.toContain('<b>1</b>');
		expect(out).not.toContain('<script>x');
		expect(out).toContain('&lt;script>x&lt;/script>');
	});
});
