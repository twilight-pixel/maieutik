import { describe, expect, it } from 'vitest';
import {
	CALLOUT_VARIANTS,
	LIMITS,
	countLinks,
	normalizeDocument,
	plainText,
	sourceRefs,
	validateDocument
} from './blocks';

const tiptapOutput = {
	type: 'doc',
	content: [
		{
			type: 'heading',
			attrs: { level: 2, textAlign: null },
			content: [{ type: 'text', text: 'Thèse' }]
		},
		{
			type: 'paragraph',
			attrs: { textAlign: null },
			content: [
				{ type: 'text', text: 'Voir ' },
				{
					type: 'text',
					text: 'la source',
					marks: [
						{
							type: 'link',
							attrs: { href: 'https://example.org/a', target: '_blank', rel: null, class: null }
						}
					]
				},
				{ type: 'hardBreak' },
				{ type: 'text', text: 'fin', marks: [{ type: 'bold' }] }
			]
		},
		{
			type: 'bulletList',
			content: [
				{
					type: 'listItem',
					content: [{ type: 'paragraph', content: [{ type: 'text', text: 'point' }] }]
				}
			]
		},
		{ type: 'codeBlock', attrs: { language: null }, content: [{ type: 'text', text: 'x = 1' }] },
		{ type: 'horizontalRule' }
	]
};

const withNode = (node: unknown) => ({ type: 'doc', content: [node] });
const paragraphWithMarks = (marks: unknown) =>
	withNode({ type: 'paragraph', content: [{ type: 'text', text: 'a', marks }] });

describe('documents', () => {
	it('normalise la sortie de l’éditeur en retirant les attributs non autorisés', () => {
		const doc = normalizeDocument(tiptapOutput);
		expect(doc.content[0]).toEqual({
			type: 'heading',
			attrs: { level: 2 },
			content: [{ type: 'text', text: 'Thèse' }]
		});
		expect(validateDocument(doc)).toBeNull();
		expect(validateDocument(tiptapOutput)).toMatch(/non normalisé/);
	});

	it('extrait le texte brut et compte les liens', () => {
		const doc = normalizeDocument(tiptapOutput);
		expect(plainText(doc)).toBe('Thèse\nVoir la source\nfin\npoint\nx = 1');
		expect(countLinks(doc)).toBe(1);
	});

	it('refuse les nœuds, marques et liens dangereux', () => {
		expect(() =>
			normalizeDocument(withNode({ type: 'image', attrs: { src: 'https://x' } }))
		).toThrow(/non pris en charge/);
		expect(() =>
			normalizeDocument(withNode({ type: 'heading', attrs: { level: 1 }, content: [] }))
		).toThrow(/niveau/);
		expect(() =>
			normalizeDocument(
				paragraphWithMarks([{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])
			)
		).toThrow(/lien refusé/);
		expect(() =>
			normalizeDocument(paragraphWithMarks([{ type: 'link', attrs: { href: '/relatif' } }]))
		).toThrow(/lien refusé/);
		expect(() => normalizeDocument(paragraphWithMarks([{ type: 'highlight' }]))).toThrow(
			/non prise en charge/
		);
		expect(validateDocument({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(
			'document vide'
		);
	});

	it('borne la profondeur d’imbrication', () => {
		let node: unknown = { type: 'paragraph', content: [{ type: 'text', text: 'a' }] };
		for (let i = 0; i < 20; i++) node = { type: 'blockquote', content: [node] };
		expect(() => normalizeDocument({ type: 'doc', content: [node] })).toThrow(/profonde/);
	});
});

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const cell = (text: string, type = 'tableCell') => ({
	type,
	attrs: { colspan: 1, rowspan: 1, colwidth: null },
	content: [para(text)]
});
const row = (...cells: unknown[]) => ({ type: 'tableRow', content: cells });
const docOf = (...content: unknown[]) => ({ type: 'doc', content });

describe('tableaux', () => {
	const tiptapTable = {
		type: 'table',
		content: [
			row(cell('Auteur', 'tableHeader'), cell('Thèse', 'tableHeader')),
			row(cell('Platon'), cell('Les idées')),
			row(cell('Aristote'), { ...cell(''), content: [{ type: 'paragraph' }] })
		]
	};

	it('normalise la sortie de l’éditeur (attributs de fusion et de largeur retirés)', () => {
		const doc = normalizeDocument(docOf(tiptapTable));
		const [first] = (doc.content[0] as { content: { content: unknown[] }[] }).content;
		expect(first.content[0]).toEqual({
			type: 'tableHeader',
			content: [para('Auteur')]
		});
		expect(validateDocument(doc)).toBeNull();
		expect(plainText(doc)).toBe('Auteur\nThèse\nPlaton\nLes idées\nAristote\n');
	});

	it('refuse les tableaux mal formés', () => {
		const table = (...rows: unknown[]) => docOf({ type: 'table', content: rows });
		expect(() => normalizeDocument(table())).toThrow(/lignes attendues/);
		expect(() => normalizeDocument(table(row(cell('a'), cell('b')), row(cell('c'))))).toThrow(
			/inégale/
		);
		expect(() => normalizeDocument(table(row()))).toThrow(/colonnes attendues/);
		expect(() =>
			normalizeDocument(table(row({ ...cell('a'), attrs: { colspan: 2, rowspan: 1 } })))
		).toThrow(/fusionnées/);
		expect(() =>
			normalizeDocument(
				table(row({ ...cell('a'), content: [{ type: 'bulletList', content: [] }] }))
			)
		).toThrow(/paragraphes/);
		expect(() => normalizeDocument(table({ type: 'paragraph' }))).toThrow(/ligne attendue/);
	});

	it('borne le nombre de lignes et de colonnes', () => {
		const wide = row(...Array.from({ length: LIMITS.maxTableColumns + 1 }, () => cell('a')));
		expect(() => normalizeDocument(docOf({ type: 'table', content: [wide] }))).toThrow(
			/colonnes attendues/
		);
		const rows = Array.from({ length: LIMITS.maxTableRows + 1 }, () => row(cell('a')));
		expect(() => normalizeDocument(docOf({ type: 'table', content: rows }))).toThrow(
			/lignes attendues/
		);
	});

	it('compte les liens et les renvois de source dans les cellules', () => {
		const linked = {
			type: 'tableCell',
			content: [
				{
					type: 'paragraph',
					content: [
						{
							type: 'text',
							text: 'a',
							marks: [
								{ type: 'link', attrs: { href: 'https://example.org' } },
								{ type: 'sourceRef', attrs: { source: 's1' } }
							]
						}
					]
				}
			]
		};
		const doc = normalizeDocument(docOf({ type: 'table', content: [row(linked)] }));
		expect(countLinks(doc)).toBe(1);
		expect(sourceRefs(doc)).toEqual(['s1']);
	});
});

describe('encadrés et colonnes', () => {
	it('accepte les trois types d’encadré et leur contenu', () => {
		for (const variant of CALLOUT_VARIANTS) {
			const doc = normalizeDocument(
				docOf({ type: 'callout', attrs: { variant }, content: [para('Définition')] })
			);
			expect(doc.content[0]).toEqual({
				type: 'callout',
				attrs: { variant },
				content: [para('Définition')]
			});
		}
		expect(() =>
			normalizeDocument(docOf({ type: 'callout', attrs: { variant: 'x' }, content: [para('a')] }))
		).toThrow(/type d’encadré/);
		expect(() =>
			normalizeDocument(docOf({ type: 'callout', attrs: { variant: 'remark' }, content: [] }))
		).toThrow(/contenu vide/);
	});

	it('exige deux ou trois colonnes', () => {
		const column = (text: string) => ({ type: 'column', content: [para(text)] });
		const columns = (...content: unknown[]) => docOf({ type: 'columns', content });
		const ok = normalizeDocument(columns(column('Thèse'), column('Réfutation')));
		expect(plainText(ok)).toBe('Thèse\nRéfutation');
		expect(() => normalizeDocument(columns(column('seule')))).toThrow(/colonnes attendues/);
		expect(() =>
			normalizeDocument(columns(column('a'), column('b'), column('c'), column('d')))
		).toThrow(/colonnes attendues/);
		expect(() => normalizeDocument(columns(column('a'), para('b')))).toThrow(/colonne attendue/);
	});
});

describe('formules', () => {
	it('accepte une formule en bloc et dans une ligne', () => {
		const doc = normalizeDocument(
			docOf(
				{ type: 'mathBlock', attrs: { latex: ' \\frac{a}{b} ' } },
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'Soit ' },
						{ type: 'mathInline', attrs: { latex: 'x^2' } }
					]
				}
			)
		);
		expect(doc.content[0]).toEqual({ type: 'mathBlock', attrs: { latex: '\\frac{a}{b}' } });
		expect(plainText(doc)).toBe('\\frac{a}{b}\nSoit x^2');
	});

	it('refuse les formules vides, trop longues ou piégées', () => {
		const block = (latex: unknown) => docOf({ type: 'mathBlock', attrs: { latex } });
		const inline = (latex: unknown) =>
			docOf({ type: 'paragraph', content: [{ type: 'mathInline', attrs: { latex } }] });
		expect(() => normalizeDocument(block('  '))).toThrow(/vide/);
		expect(() => normalizeDocument(block(42))).toThrow(/texte attendu/);
		expect(() => normalizeDocument(block('x'.repeat(LIMITS.maxLatexLength + 1)))).toThrow(
			/caractères au plus/
		);
		expect(() => normalizeDocument(block(`a${String.fromCharCode(0)}b`))).toThrow(/contrôle/);
		// Un saut de ligne passe en bloc, pas dans une ligne de texte.
		expect(normalizeDocument(block('a\nb')).content).toHaveLength(1);
		expect(() => normalizeDocument(inline('a\nb'))).toThrow(/contrôle/);
	});
});

describe('frises et schémas', () => {
	const timeline = (events: unknown) => docOf({ type: 'timeline', attrs: { events } });
	const diagram = (nodes: unknown, edges: unknown) =>
		docOf({ type: 'diagram', attrs: { nodes, edges } });

	it('normalise une frise et la rend cherchable', () => {
		const doc = normalizeDocument(
			timeline([
				{ date: ' 1789 ', title: 'Bastille', text: 'Début', extra: 1 },
				{ date: '1792', title: 'République', text: '' }
			])
		);
		expect((doc.content[0] as { attrs: { events: unknown[] } }).attrs.events[0]).toEqual({
			date: '1789',
			title: 'Bastille',
			text: 'Début'
		});
		expect(plainText(doc)).toBe('1789 Bastille Début\n1792 République');
	});

	it('refuse les frises invalides', () => {
		expect(() => normalizeDocument(timeline([]))).toThrow(/événements attendus/);
		expect(() => normalizeDocument(timeline([{ date: '', title: 't', text: '' }]))).toThrow(/vide/);
		expect(() => normalizeDocument(timeline([{ date: 'd', title: 't', text: 5 }]))).toThrow(
			/texte attendu/
		);
		expect(() => normalizeDocument(timeline([{ date: 'd', title: 'a\nb', text: '' }]))).toThrow(
			/contrôle/
		);
	});

	it('normalise un schéma et indexe ses relations', () => {
		const doc = normalizeDocument(
			diagram(['A', 'B'], [{ from: 0, to: 1, label: ' donc ', extra: true }])
		);
		expect(doc.content[0]).toEqual({
			type: 'diagram',
			attrs: { nodes: ['A', 'B'], edges: [{ from: 0, to: 1, label: 'donc' }] }
		});
		expect(plainText(doc)).toBe('A\nB\ndonc');
	});

	it('refuse les schémas incohérents', () => {
		const edge = (from: unknown, to: unknown) => [{ from, to, label: '' }];
		expect(() => normalizeDocument(diagram([], []))).toThrow(/éléments attendus/);
		expect(() => normalizeDocument(diagram(['A', 'A'], []))).toThrow(/double/);
		expect(() => normalizeDocument(diagram(['A', 'B'], edge(0, 2)))).toThrow(/inconnu/);
		expect(() => normalizeDocument(diagram(['A', 'B'], edge(-1, 1)))).toThrow(/inconnu/);
		expect(() => normalizeDocument(diagram(['A', 'B'], edge(0.5, 1)))).toThrow(/inconnu/);
		expect(() => normalizeDocument(diagram(['A', 'B'], edge(1, 1)))).toThrow(/lui-même/);
		expect(() => normalizeDocument(diagram(['A', 'B'], [...edge(0, 1), ...edge(0, 1)]))).toThrow(
			/double/
		);
	});

	it('refuse tout attribut non normalisé côté serveur', () => {
		const normalized = normalizeDocument(diagram(['A', 'B'], [{ from: 0, to: 1, label: '' }]));
		expect(validateDocument(normalized)).toBeNull();
		const tampered = JSON.parse(JSON.stringify(normalized));
		tampered.content[0].attrs.edges[0].label = ' avec espaces ';
		expect(validateDocument(tampered)).toMatch(/non normalisé/);
		tampered.content[0].attrs = { ...tampered.content[0].attrs, html: '<b>x</b>' };
		expect(validateDocument(tampered)).toMatch(/non normalisé/);
	});
});

describe('avertissements par bloc (D18)', () => {
	const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
	const warned = (warnings: unknown, content: unknown[] = [paragraph('Passage sensible')]) => ({
		type: 'doc',
		content: [{ type: 'warningBlock', attrs: { warnings }, content }]
	});

	it('normalise l’ordre des catégories et rend le passage cherchable', () => {
		const doc = normalizeDocument(warned(['other', 'violence']));
		expect(doc.content[0]).toEqual({
			type: 'warningBlock',
			attrs: { warnings: ['violence', 'other'] },
			content: [paragraph('Passage sensible')]
		});
		expect(validateDocument(doc)).toBeNull();
		expect(validateDocument(warned(['other', 'violence']))).toMatch(/non normalisé/);
		expect(plainText(doc)).toBe('Passage sensible');
	});

	it('refuse une liste vide, inconnue ou en double, et un contenu vide', () => {
		expect(() => normalizeDocument(warned([]))).toThrow(/avertissements attendus/);
		expect(() => normalizeDocument(warned(['gore']))).toThrow(/avertissements attendus/);
		expect(() => normalizeDocument(warned(['violence', 'violence']))).toThrow(
			/avertissements attendus/
		);
		expect(() => normalizeDocument(warned(['violence'], []))).toThrow(/contenu vide/);
	});
});
