import { describe, expect, it } from 'vitest';
import { deleteDraft, isBlank, loadDraft, readDraft, saveDraft, type Draft } from './draft';

/** Stockage en mémoire, avec un mode « plein » pour simuler un navigateur qui refuse l'écriture. */
function memory(full = false) {
	const data = new Map<string, string>();
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			if (full) throw new Error('QuotaExceededError');
			data.set(key, value);
		}
	};
}

const paragraph = (value: string) => ({
	type: 'paragraph',
	content: [{ type: 'text', text: value }]
});

const draft = (overrides: Partial<Draft> = {}): Draft => ({
	title: 'Un titre',
	category: 'philosophy/ethics',
	kind: 'essay',
	lang: 'fr',
	tags: 'liberté, loi',
	warnings: ['violence'],
	sources: [{ title: 'Source', author: '', date: '2013', publisher: '', url: '' }],
	deferred: true,
	relation: 'refutes',
	body: { type: 'doc', content: [paragraph('Bonjour')] },
	...overrides
});

describe('brouillons locaux', () => {
	it('restitue ce qui a été enregistré, par contexte', () => {
		const storage = memory();
		expect(saveDraft('new', draft(), storage)).toBe(true);
		expect(saveDraft('reply:abc:refutes', draft({ title: 'Réponse' }), storage)).toBe(true);
		expect(loadDraft('new', storage)).toEqual(draft());
		expect(loadDraft('reply:abc:refutes', storage)?.title).toBe('Réponse');
		expect(loadDraft('version:xyz', storage)).toBeNull();
	});

	it("n'enregistre pas un brouillon vide et efface l'ancien", () => {
		const storage = memory();
		saveDraft('new', draft(), storage);
		const empty = draft({
			title: ' ',
			sources: [],
			body: { type: 'doc', content: [{ type: 'paragraph' }] }
		});
		expect(isBlank(empty)).toBe(true);
		expect(saveDraft('new', empty, storage)).toBe(true);
		expect(loadDraft('new', storage)).toBeNull();
	});

	it('supprime un brouillon publié', () => {
		const storage = memory();
		saveDraft('new', draft(), storage);
		deleteDraft('new', storage);
		expect(loadDraft('new', storage)).toBeNull();
	});

	it('ne garde que les dix derniers contextes', () => {
		const storage = memory();
		for (let i = 0; i < 12; i++) saveDraft(`reply:${i}`, draft({ title: `t${i}` }), storage);
		expect(loadDraft('reply:0', storage)).toBeNull();
		expect(loadDraft('reply:1', storage)).toBeNull();
		expect(loadDraft('reply:2', storage)?.title).toBe('t2');
		expect(loadDraft('reply:11', storage)?.title).toBe('t11');
	});

	it('réécrire un contexte le rend le plus récent', () => {
		const storage = memory();
		for (let i = 0; i < 10; i++) saveDraft(`c${i}`, draft({ title: `t${i}` }), storage);
		saveDraft('c0', draft({ title: 'relu' }), storage);
		saveDraft('c10', draft({ title: 't10' }), storage);
		expect(loadDraft('c0', storage)?.title).toBe('relu');
		expect(loadDraft('c1', storage)).toBeNull();
	});

	it("signale un stockage qui refuse l'écriture", () => {
		expect(saveDraft('new', draft(), memory(true))).toBe(false);
	});

	it('survit à un contenu illisible ou mal formé', () => {
		const storage = memory();
		storage.setItem('maieutik-drafts', '{pas du json');
		expect(loadDraft('new', storage)).toBeNull();
		storage.setItem(
			'maieutik-drafts',
			JSON.stringify({ new: { title: 12, body: 'x', warnings: [1, 'violence'], sources: [3, {}] } })
		);
		const read = loadDraft('new', storage);
		// Titre non textuel et corps invalide : ignorés ; les sources mal formées deviennent vides.
		expect(read).toBeNull();
		expect(readDraft({ title: 12, body: 'x', warnings: [1, 'violence'] })).toMatchObject({
			title: '',
			body: null,
			warnings: ['violence']
		});
	});
});
