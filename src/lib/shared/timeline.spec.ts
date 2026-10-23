import { describe, expect, it } from 'vitest';
import { LIMITS, normalizeDocument } from './blocks';
import { parseTimeline, serializeTimeline } from './timeline';

describe('saisie d’une frise', () => {
	it('lit « date | titre | description »', () => {
		const { events, error } = parseTimeline(
			'1789 | Prise de la Bastille | Début de la Révolution\n\n 1792 | Première République'
		);
		expect(error).toBeNull();
		expect(events).toEqual([
			{ date: '1789', title: 'Prise de la Bastille', text: 'Début de la Révolution' },
			{ date: '1792', title: 'Première République', text: '' }
		]);
	});

	it('garde les barres verticales de la description', () => {
		const { events } = parseTimeline('2020 | Titre | a | b');
		expect(events[0].text).toBe('a | b');
	});

	it('signale la ligne fautive', () => {
		expect(parseTimeline('').error).toEqual({ line: 0, code: 'empty' });
		expect(parseTimeline('sans barre').error).toEqual({ line: 1, code: 'missing-title' });
		expect(parseTimeline('1789 | ok\n | titre').error).toEqual({ line: 2, code: 'missing-date' });
		expect(parseTimeline('1789 |  | desc').error).toEqual({ line: 1, code: 'missing-title' });
		const long = `${'x'.repeat(LIMITS.maxTimelineDate + 1)} | titre`;
		expect(parseTimeline(long).error).toEqual({ line: 1, code: 'too-long' });
		const many = Array.from({ length: LIMITS.maxTimelineEvents + 1 }, (_, i) => `${i} | t`).join(
			'\n'
		);
		expect(parseTimeline(many).error).toEqual({ line: 0, code: 'too-many' });
	});

	it('produit des attributs acceptés par le schéma de blocs, et se relit', () => {
		const { events } = parseTimeline('1789 | Bastille | Début\n1792 | République');
		const doc = normalizeDocument({
			type: 'doc',
			content: [{ type: 'timeline', attrs: { events } }]
		});
		expect(doc.content[0]).toEqual({ type: 'timeline', attrs: { events } });
		expect(parseTimeline(serializeTimeline(events)).events).toEqual(events);
	});
});
