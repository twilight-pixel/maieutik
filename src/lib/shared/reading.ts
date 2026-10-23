/**
 * Aides à la lecture d'un texte long : temps de lecture et plan des titres.
 *
 * Code isomorphe : le serveur rend le plan, le navigateur le garde à jour. Rien ici ne
 * touche au contenu signé, tout se déduit de l'arbre de blocs.
 */
import { plainText, type DocNode } from './blocks';

/** Mots lus par minute. Lecture attentive d'un texte argumenté, un peu sous la lecture courante. */
const WORDS_PER_MINUTE = 220;

/** En dessous, afficher un temps de lecture n'apporte rien. */
const MIN_WORDS_SHOWN = 150;

/** Nombre de titres à partir duquel un plan aide vraiment à se repérer. */
export const MIN_HEADINGS_FOR_OUTLINE = 3;

export type Outline = { id: string; level: 2 | 3; title: string }[];

/** Identifiant d'ancre d'un titre de premier niveau, d'après sa position dans le document. */
export const headingId = (index: number): string => `s-${index}`;

export function countWords(doc: DocNode): number {
	return plainText(doc).split(/\s+/).filter(Boolean).length;
}

/** Minutes de lecture (arrondies, au moins 1), ou `null` si le texte est trop court. */
export function readingMinutes(words: number): number | null {
	return words < MIN_WORDS_SHOWN ? null : Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Titres de premier niveau, dans l'ordre. Ceux qui sont vides sont ignorés. */
export function outline(doc: DocNode): Outline {
	const result: Outline = [];
	doc.content.forEach((node, index) => {
		if (node.type !== 'heading') return;
		const title = (node.content ?? [])
			.map((inline) =>
				inline.type === 'text'
					? inline.text
					: inline.type === 'mathInline'
						? inline.attrs.latex
						: ' '
			)
			.join('')
			.trim();
		if (title) result.push({ id: headingId(index), level: node.attrs.level, title });
	});
	return result;
}

/** Longueur maximale du début de texte montré dans une liste. */
const INTRO_LENGTH = 220;

/** Début d'un texte pour une liste : espaces réduits, coupé à la fin d'un mot, « … » si tronqué. */
export function intro(source: string | null, max = INTRO_LENGTH): string | null {
	const flat = (source ?? '').replace(/\s+/g, ' ').trim();
	if (!flat) return null;
	if (flat.length <= max) return flat;
	const cut = flat.slice(0, max);
	return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max / 2))}…`;
}
