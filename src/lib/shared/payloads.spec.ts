import { describe, expect, it } from 'vitest';
import {
	normalizeTags,
	normalizeWarnings,
	validateDecision,
	validatePseudonym,
	validateReport,
	validateQuestion,
	validateTextVersion,
	type TextVersionPayload
} from './payloads';

const text: TextVersionPayload = {
	textId: crypto.randomUUID(),
	version: 1,
	category: 'philosophy/ethics',
	lang: 'fr',
	kind: 'essay',
	title: 'Sur la liberté',
	body: {
		type: 'doc',
		content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bonjour' }] }]
	},
	tags: ['liberté', 'morale'],
	warnings: [],
	relation: null,
	question: null,
	sources: [],
	deferred: false
};

const source = {
	id: 's1',
	title: 'De la démocratie en Amérique',
	author: 'Alexis de Tocqueville',
	date: '1835',
	publisher: null,
	url: 'https://fr.wikisource.org/wiki/De_la_d%C3%A9mocratie_en_Am%C3%A9rique'
};

const citing = {
	type: 'doc',
	content: [
		{
			type: 'paragraph',
			content: [
				{ type: 'text', text: 'Selon Tocqueville' },
				{ type: 'text', text: '1', marks: [{ type: 'sourceRef', attrs: { source: 's1' } }] }
			]
		}
	]
};

describe('contenus signés', () => {
	it('accepte un texte valide', () => {
		expect(validateTextVersion(text)).toEqual({ ok: true, value: text });
		expect(validateTextVersion({ ...text, category: 'philosophy' }).ok).toBe(true);
	});

	it('refuse un texte mal formé', () => {
		const cases: [Record<string, unknown>, RegExp][] = [
			[{ category: 'philosophy/physics' }, /catégorie/],
			[{ title: ' espace' }, /titre/],
			[{ tags: ['b', 'a'] }, /ordre/],
			[{ tags: ['A'] }, /minuscules/],
			[{ warnings: ['other', 'violence'] }, /ordre canonique/],
			[{ relation: { kind: 'refutes', target: text.textId } }, /lui-même/],
			[{ relation: { kind: 'likes', target: crypto.randomUUID() } }, /type inconnu/],
			[
				{
					relation: { kind: 'refutes', target: crypto.randomUUID() },
					question: crypto.randomUUID()
				},
				/pas les deux/
			],
			[{ body: citing }, /source inexistante/],
			[{ sources: [{ ...source, id: 's2' }] }, /s1 attendu/],
			[{ sources: [{ ...source, url: 'javascript:alert(1)' }] }, /http/],
			[{ sources: [{ ...source, date: '18-35' }] }, /date/],
			[{ version: 0 }, /version/],
			[{ extra: 1 }, /champs attendus/]
		];
		for (const [patch, error] of cases) {
			const result = validateTextVersion({ ...text, ...patch });
			expect(result.ok, JSON.stringify(patch)).toBe(false);
			if (!result.ok) expect(result.error).toMatch(error);
		}
	});

	it('accepte relations typées, rattachement à une question et sources citées', () => {
		const target = crypto.randomUUID();
		expect(validateTextVersion({ ...text, relation: { kind: 'refutes', target } }).ok).toBe(true);
		expect(validateTextVersion({ ...text, question: crypto.randomUUID() }).ok).toBe(true);
		expect(validateTextVersion({ ...text, body: citing, sources: [source] }).ok).toBe(true);
	});

	it('valide une question', () => {
		const question = {
			questionId: crypto.randomUUID(),
			title: 'Le tirage au sort est-il démocratique ?',
			category: 'politics/institutions',
			lang: 'fr',
			context: ''
		};
		expect(validateQuestion(question).ok).toBe(true);
		expect(validateQuestion({ ...question, context: ' x' }).ok).toBe(false);
		expect(validateQuestion({ ...question, category: 'x' }).ok).toBe(false);
	});

	it('normalise étiquettes et avertissements', () => {
		expect(normalizeTags([' Morale ', 'liberté', 'morale', ''])).toEqual(['liberté', 'morale']);
		expect(normalizeWarnings(['other', 'violence', 'x'])).toEqual(['violence', 'other']);
	});

	it('valide pseudonymes, signalements et décisions', () => {
		expect(validatePseudonym({ displayName: 'Hypatie' }).ok).toBe(true);
		expect(validatePseudonym({ displayName: 'Hy#patie' }).ok).toBe(false);
		expect(validatePseudonym({ displayName: 'a\tb' }).ok).toBe(false);

		const report = {
			reportId: crypto.randomUUID(),
			textId: text.textId,
			version: 1,
			category: 'personal-data',
			passage: 'adresse',
			justification: 'Adresse personnelle publiée.'
		};
		expect(validateReport(report).ok).toBe(true);
		expect(validateReport({ ...report, category: 'je-n-aime-pas' }).ok).toBe(false);

		const decision = {
			decisionId: crypto.randomUUID(),
			reportId: report.reportId,
			appealId: null,
			textId: text.textId,
			questionId: null,
			category: 'personal-data',
			legalBasis: 'RGPD art. 6',
			reasoning: 'Donnée personnelle sans consentement.',
			outcome: 'removed',
			warning: null
		};
		expect(validateDecision(decision).ok).toBe(true);
		expect(validateDecision({ ...decision, outcome: 'warning_added' }).ok).toBe(false);
		expect(
			validateDecision({ ...decision, outcome: 'warning_added', warning: 'violence' }).ok
		).toBe(true);
		// Une décision vise un texte ou une question, jamais les deux ni aucun.
		expect(validateDecision({ ...decision, questionId: crypto.randomUUID() }).ok).toBe(false);
		expect(validateDecision({ ...decision, textId: null }).ok).toBe(false);
		const onQuestion = { ...decision, textId: null, questionId: crypto.randomUUID() };
		expect(validateDecision(onQuestion).ok).toBe(true);
		expect(validateDecision({ ...onQuestion, outcome: 'hidden' }).ok).toBe(false);
	});
});
