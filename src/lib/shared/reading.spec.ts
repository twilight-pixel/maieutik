import { describe, expect, it } from 'vitest';
import type { DocNode } from './blocks';
import { countWords, headingId, intro, outline, readingMinutes } from './reading';

const text = (value: string) => ({ type: 'text' as const, text: value });
const paragraph = (value: string) => ({ type: 'paragraph' as const, content: [text(value)] });
const heading = (level: 2 | 3, value: string) => ({
	type: 'heading' as const,
	attrs: { level },
	content: [text(value)]
});

describe('temps de lecture', () => {
	it('compte les mots du texte brut', () => {
		const doc: DocNode = { type: 'doc', content: [heading(2, 'Un titre'), paragraph('a b  c\nd')] };
		expect(countWords(doc)).toBe(6);
	});

	it("n'affiche rien pour un texte court", () => {
		expect(readingMinutes(149)).toBeNull();
	});

	it('arrondit à la minute, au moins une', () => {
		expect(readingMinutes(150)).toBe(1);
		expect(readingMinutes(1100)).toBe(5);
		expect(readingMinutes(22_000)).toBe(100);
	});
});

describe('plan', () => {
	it('liste les titres de premier niveau avec leur position', () => {
		const doc: DocNode = {
			type: 'doc',
			content: [
				paragraph('Introduction'),
				heading(2, 'Thèse'),
				paragraph('…'),
				heading(3, 'Objection'),
				{ type: 'blockquote', content: [heading(2, 'Caché')] }
			]
		};
		expect(outline(doc)).toEqual([
			{ id: headingId(1), level: 2, title: 'Thèse' },
			{ id: headingId(3), level: 3, title: 'Objection' }
		]);
	});

	it('ignore les titres vides et lit les formules en ligne', () => {
		const doc: DocNode = {
			type: 'doc',
			content: [
				{ type: 'heading', attrs: { level: 2 } },
				{
					type: 'heading',
					attrs: { level: 2 },
					content: [text('Soit '), { type: 'mathInline', attrs: { latex: 'x^2' } }]
				}
			]
		};
		expect(outline(doc)).toEqual([{ id: headingId(1), level: 2, title: 'Soit x^2' }]);
	});
});

describe('début de texte', () => {
	it('réduit les espaces et les retours à la ligne', () => {
		expect(intro('  Un  texte\n\ncourt \t.  ')).toBe('Un texte court .');
	});

	it('ne garde rien pour un corps vide ou retiré', () => {
		expect(intro(null)).toBeNull();
		expect(intro(' \n ')).toBeNull();
	});

	it("coupe à la fin d'un mot et le signale", () => {
		expect(intro('mot '.repeat(100), 30)).toBe('mot mot mot mot mot mot mot…');
		expect(intro('mot mot', 30)).toBe('mot mot');
	});

	it('garde la lettre s (régression : une expression régulière sans antislash)', () => {
		expect(intro('selon la source, assez simple')).toBe('selon la source, assez simple');
	});
});
