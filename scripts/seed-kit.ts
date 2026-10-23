/**
 * Briques communes des données de test (voir scripts/seed.ts) : identifiants et clés
 * dérivés de libellés fixes, constructeurs de documents, forme des questions et des textes.
 */
import { createHash } from 'node:crypto';
import type { DocNode, BlockNode, InlineNode } from '../src/lib/shared/blocks';
import type { ContentWarning, Lang, RelationKind, TextKind } from '../src/lib/shared/content';
import {
	derivePseudonymKeypair,
	mnemonicFromEntropy,
	mnemonicToSeed
} from '../src/lib/shared/identity';
import type { QuestionPayload, Source } from '../src/lib/shared/payloads';

// --- Identifiants et clés dérivés de libellés fixes ---------------------------------------

export function sha(label: string): Buffer {
	return createHash('sha256').update(`maieutik-seed/${label}`).digest();
}

/** UUID v4 déterministe (le serveur n'accepte que ce format). */
export function id(label: string): string {
	const bytes = sha(label).subarray(0, 16);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = bytes.toString('hex');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function author(name: string) {
	const mnemonic = mnemonicFromEntropy(sha(`pseudonyme/${name}`).subarray(0, 16));
	return { name, keys: derivePseudonymKeypair(mnemonicToSeed(mnemonic)) };
}

export const diotime = author('Diotime');
export const menon = author('Ménon');
export const aspasie = author('Aspasie');
export const theetete = author('Théétète');
export type Author = typeof diotime;

// --- Constructeurs de documents -----------------------------------------------------------

export type Part = string | InlineNode;
const inline = (parts: Part[]): InlineNode[] =>
	parts.map((part) => (typeof part === 'string' ? { type: 'text', text: part } : part));

export const p = (...parts: Part[]): BlockNode => ({ type: 'paragraph', content: inline(parts) });
export const h2 = (text: string): BlockNode => ({
	type: 'heading',
	attrs: { level: 2 },
	content: [{ type: 'text', text }]
});
export const quote = (...parts: Part[]): BlockNode => ({
	type: 'blockquote',
	content: [p(...parts)]
});
export const list = (...items: string[]): BlockNode => ({
	type: 'bulletList',
	content: items.map((item) => ({ type: 'listItem', content: [p(item)] }))
});
export const em = (text: string): InlineNode => ({
	type: 'text',
	text,
	marks: [{ type: 'italic' }]
});
/** Appel de note renvoyant à la source `sN` du texte. */
export const ref = (text: string, n = 1): InlineNode => ({
	type: 'text',
	text,
	marks: [{ type: 'sourceRef', attrs: { source: `s${n}` } }]
});
export const h3 = (text: string): BlockNode => ({
	type: 'heading',
	attrs: { level: 3 },
	content: [{ type: 'text', text }]
});
export const ol = (...items: string[]): BlockNode => ({
	type: 'orderedList',
	attrs: { start: 1 },
	content: items.map((item) => ({ type: 'listItem', content: [p(item)] }))
});
export const hr: BlockNode = { type: 'horizontalRule' };
export const code = (text: string): BlockNode => ({
	type: 'codeBlock',
	content: [{ type: 'text', text }]
});
export const strong = (text: string): InlineNode => ({
	type: 'text',
	text,
	marks: [{ type: 'bold' }]
});
export const link = (text: string, href: string): InlineNode => ({
	type: 'text',
	text,
	marks: [{ type: 'link', attrs: { href } }]
});
export const doc = (...content: BlockNode[]): DocNode => ({ type: 'doc', content });

export const source = (
	n: number,
	title: string,
	authorName: string | null,
	date: string | null,
	publisher: string | null = null,
	url: string | null = null
): Source => ({ id: `s${n}`, title, author: authorName, date, publisher, url });

// --- Forme des graines ---------------------------------------------------------------------

export type QuestionSeed = Omit<QuestionPayload, 'questionId'> & { key: string; by: Author };

export type TextSeed = {
	key: string;
	by: Author;
	title: string;
	body: DocNode;
	category: string;
	kind: TextKind;
	lang?: Lang;
	tags?: string[];
	warnings?: ContentWarning[];
	/** Clé d'une question de QUESTIONS (position). */
	question?: string;
	/** Relation vers la clé d'un autre texte (réponse). */
	relation?: { kind: RelationKind; target: string };
	sources?: Source[];
};
