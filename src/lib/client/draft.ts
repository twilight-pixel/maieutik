/**
 * Brouillons de texte, gardés dans ce navigateur seulement.
 *
 * Un texte long se perd vite : fausse manœuvre, plantage, onglet fermé, navigateur qui efface
 * le stockage. Le formulaire d'écriture enregistre donc son contenu localement à chaque pause,
 * et le restaure à la réouverture. Rien n'est envoyé au serveur avant la signature, et le
 * brouillon est effacé dès la publication.
 *
 * Un brouillon par contexte (nouveau texte, réponse à tel texte, nouvelle version de tel texte…),
 * sans date ni heure, limité aux derniers contextes utilisés. Il n'est pas chiffré : c'est un
 * texte destiné à devenir public, mais quelqu'un qui accède à l'appareil peut le lire. Si le
 * stockage est indisponible (Tor Browser, navigation privée), `saveDraft` renvoie `false` et
 * l'interface le dit.
 */
import type { JSONContent } from '@tiptap/core';

const KEY = 'maieutik-drafts';
const MAX_DRAFTS = 10;

export type DraftSource = {
	title: string;
	author: string;
	date: string;
	publisher: string;
	url: string;
};

/** Ce que le formulaire d'écriture garde. Le corps est la sortie brute de l'éditeur. */
export type Draft = {
	title: string;
	category: string;
	kind: string;
	lang: string;
	tags: string;
	warnings: string[];
	sources: DraftSource[];
	deferred: boolean;
	relation: string;
	body: JSONContent | null;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Drafts = Record<string, Draft>;

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function readSource(value: unknown): DraftSource | null {
	if (!isObject(value)) return null;
	return {
		title: text(value.title),
		author: text(value.author),
		date: text(value.date),
		publisher: text(value.publisher),
		url: text(value.url)
	};
}

/** Relit un brouillon enregistré : la valeur vient du stockage, on ne lui fait pas confiance. */
export function readDraft(value: unknown): Draft | null {
	if (!isObject(value)) return null;
	const body =
		isObject(value.body) && value.body.type === 'doc' ? (value.body as JSONContent) : null;
	return {
		title: text(value.title),
		category: text(value.category),
		kind: text(value.kind),
		lang: text(value.lang),
		tags: text(value.tags),
		warnings: Array.isArray(value.warnings)
			? value.warnings.filter((w): w is string => typeof w === 'string')
			: [],
		sources: Array.isArray(value.sources)
			? value.sources.map(readSource).filter((s): s is DraftSource => s !== null)
			: [],
		deferred: value.deferred === true,
		relation: text(value.relation),
		body
	};
}

function readAll(storage: StorageLike): Drafts {
	try {
		const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? '{}');
		if (!isObject(parsed)) return {};
		const drafts: Drafts = {};
		for (const [context, value] of Object.entries(parsed)) {
			const draft = readDraft(value);
			if (draft) drafts[context] = draft;
		}
		return drafts;
	} catch {
		return {};
	}
}

/** Vrai si le brouillon ne contient rien que l'auteur ait écrit (titre, texte, source remplie). */
export function isBlank(draft: Draft): boolean {
	const text = (draft.body?.content ?? []).some(
		(node) => node.type !== 'paragraph' || (node.content?.length ?? 0) > 0
	);
	return (
		draft.title.trim() === '' &&
		!text &&
		!draft.sources.some((s) => Object.values(s).some((v) => v.trim() !== ''))
	);
}

export function loadDraft(context: string, storage: StorageLike = localStorage): Draft | null {
	const draft = readAll(storage)[context];
	return draft && !isBlank(draft) ? draft : null;
}

/** Enregistre le brouillon ; renvoie `false` si le stockage refuse (indisponible ou plein). */
export function saveDraft(
	context: string,
	draft: Draft,
	storage: StorageLike = localStorage
): boolean {
	try {
		const drafts = readAll(storage);
		// Le plus récent en dernier : on retire l'ancien avant de réinsérer, puis on borne.
		delete drafts[context];
		if (!isBlank(draft)) drafts[context] = draft;
		const contexts = Object.keys(drafts);
		for (const old of contexts.slice(0, Math.max(0, contexts.length - MAX_DRAFTS))) {
			delete drafts[old];
		}
		storage.setItem(KEY, JSON.stringify(drafts));
		return true;
	} catch {
		return false;
	}
}

export function deleteDraft(context: string, storage: StorageLike = localStorage): void {
	try {
		const drafts = readAll(storage);
		if (!(context in drafts)) return;
		delete drafts[context];
		storage.setItem(KEY, JSON.stringify(drafts));
	} catch {
		// Stockage indisponible : il n'y a rien à effacer.
	}
}
