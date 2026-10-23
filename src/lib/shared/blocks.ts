/**
 * Document d'un texte : arbre de blocs au format JSON de ProseMirror/Tiptap (docs/06).
 *
 * Le document fait partie du contenu signé : il doit être validé de façon stricte et
 * identique côté navigateur (avant signature) et côté serveur (à la réception).
 * Seuls les nœuds, marques et attributs listés ici sont acceptés ; le rendu se fait
 * à partir de cet arbre, jamais à partir de HTML.
 *
 * Les blocs structurés (formule, frise, schéma) portent leurs données en attributs :
 * ce sont des données, jamais du code ni du balisage (D17).
 */

export type Mark =
	| { type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' }
	| { type: 'link'; attrs: { href: string } }
	/** Renvoi vers une source structurée du texte (`s1`, `s2`…), rendu en appel de note. */
	| { type: 'sourceRef'; attrs: { source: string } };

export type TextNode = { type: 'text'; text: string; marks?: Mark[] };
/** Formule LaTeX dans une ligne de texte. */
export type MathInlineNode = { type: 'mathInline'; attrs: { latex: string } };

import { CONTENT_WARNINGS, type ContentWarning } from './content';

export const CALLOUT_VARIANTS = ['definition', 'remark', 'warning'] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

export type TimelineEvent = { date: string; title: string; text: string };
/** Relation d'un schéma : `from` et `to` sont des positions dans `nodes`. */
export type DiagramEdge = { from: number; to: number; label: string };

export type ParagraphNode = { type: 'paragraph'; content?: InlineNode[] };
export type TableCellNode = { type: 'tableHeader' | 'tableCell'; content: ParagraphNode[] };
export type TableRowNode = { type: 'tableRow'; content: TableCellNode[] };
export type ColumnNode = { type: 'column'; content: BlockNode[] };

export type BlockNode =
	| ParagraphNode
	| { type: 'heading'; attrs: { level: 2 | 3 }; content?: InlineNode[] }
	| { type: 'blockquote'; content: BlockNode[] }
	| { type: 'bulletList'; content: ListItemNode[] }
	| { type: 'orderedList'; attrs: { start: number }; content: ListItemNode[] }
	| { type: 'codeBlock'; content?: TextNode[] }
	| { type: 'horizontalRule' }
	| { type: 'mathBlock'; attrs: { latex: string } }
	| { type: 'callout'; attrs: { variant: CalloutVariant }; content: BlockNode[] }
	/** Passage sous avertissement de contenu (docs/06, D18) : replié selon les préférences du lecteur. */
	| { type: 'warningBlock'; attrs: { warnings: ContentWarning[] }; content: BlockNode[] }
	| { type: 'columns'; content: ColumnNode[] }
	| { type: 'table'; content: TableRowNode[] }
	| { type: 'timeline'; attrs: { events: TimelineEvent[] } }
	| { type: 'diagram'; attrs: { nodes: string[]; edges: DiagramEdge[] } };

export type ListItemNode = { type: 'listItem'; content: BlockNode[] };
export type InlineNode = TextNode | { type: 'hardBreak' } | MathInlineNode;
export type DocNode = { type: 'doc'; content: BlockNode[] };

export const LIMITS = {
	maxDepth: 12,
	maxNodes: 20_000,
	maxTextLength: 200_000,
	maxHrefLength: 2_000,
	maxLatexLength: 2_000,
	maxTableRows: 100,
	maxTableColumns: 20,
	minColumns: 2,
	maxColumns: 3,
	maxTimelineEvents: 50,
	maxTimelineDate: 40,
	maxTimelineTitle: 200,
	maxTimelineText: 1_000,
	maxDiagramNodes: 30,
	maxDiagramEdges: 60,
	maxDiagramLabel: 80
} as const;

const SIMPLE_MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'code']);

class Invalid extends Error {}

/** Lien accepté : http(s) absolu uniquement (pas de javascript:, data:, ni lien relatif). */
export function isSafeHref(href: string): boolean {
	if (href.length > LIMITS.maxHrefLength) return false;
	try {
		const url = new URL(href);
		return url.protocol === 'https:' || url.protocol === 'http:';
	} catch {
		return false;
	}
}

/**
 * Normalise un document issu de l'éditeur : ne garde que les attributs autorisés.
 * Lève une erreur si un nœud ou une marque n'est pas pris en charge.
 * À appeler dans le navigateur avant la signature.
 */
export function normalizeDocument(input: unknown): DocNode {
	const state = { nodes: 0, text: 0 };
	const doc = asObject(input, 'doc');
	if (doc.type !== 'doc') throw new Invalid('racine : type « doc » attendu');
	return { type: 'doc', content: blocks(doc.content, state, 1, 'doc') };
}

/** Vrai si le document est déjà sous forme normalisée (contrôle côté serveur). */
export function validateDocument(input: unknown): string | null {
	try {
		const normalized = normalizeDocument(input);
		if (JSON.stringify(sortKeys(normalized)) !== JSON.stringify(sortKeys(input))) {
			return 'document non normalisé (attributs inattendus)';
		}
		if (plainText(normalized).trim().length === 0) return 'document vide';
		return null;
	} catch (error) {
		return error instanceof Error ? error.message : 'document invalide';
	}
}

type State = { nodes: number; text: number };

function asObject(value: unknown, path: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Invalid(`${path} : objet attendu`);
	}
	return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string, optional = false): unknown[] {
	if (value === undefined && optional) return [];
	if (!Array.isArray(value)) throw new Invalid(`${path} : liste attendue`);
	return value;
}

function count(state: State, depth: number, path: string) {
	state.nodes++;
	if (state.nodes > LIMITS.maxNodes) throw new Invalid('document trop volumineux');
	if (depth > LIMITS.maxDepth) throw new Invalid(`${path} : imbrication trop profonde`);
}

/** Caractère de contrôle, hors saut de ligne et tabulation si `multiline`. */
export function hasControl(value: string, multiline: boolean): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code === 0x7f) return true;
		if (code < 0x20 && !(multiline && (code === 0x09 || code === 0x0a))) return true;
	}
	return false;
}

/** Chaîne d'un attribut de bloc structuré : sans espaces de bord, bornée, sans contrôle. */
function attrText(
	value: unknown,
	max: number,
	path: string,
	options: { required: boolean; multiline?: boolean }
): string {
	if (typeof value !== 'string') throw new Invalid(`${path} : texte attendu`);
	const trimmed = value.trim();
	if (options.required && trimmed === '') throw new Invalid(`${path} : valeur vide`);
	if (trimmed.length > max) throw new Invalid(`${path} : ${max} caractères au plus`);
	if (hasControl(trimmed, options.multiline === true)) {
		throw new Invalid(`${path} : caractères de contrôle interdits`);
	}
	return trimmed;
}

function blocks(value: unknown, state: State, depth: number, path: string): BlockNode[] {
	const list = asArray(value, `${path}.content`);
	if (list.length === 0) throw new Invalid(`${path} : contenu vide`);
	return list.map((item, i) => block(item, state, depth, `${path}[${i}]`));
}

function paragraph(node: Record<string, unknown>, state: State, depth: number, path: string) {
	return withContent({ type: 'paragraph' as const }, inlines(node.content, state, depth + 1, path));
}

function block(value: unknown, state: State, depth: number, path: string): BlockNode {
	const node = asObject(value, path);
	count(state, depth, path);
	switch (node.type) {
		case 'paragraph':
			return paragraph(node, state, depth, path);
		case 'heading': {
			const level = asObject(node.attrs, `${path}.attrs`).level;
			if (level !== 2 && level !== 3) throw new Invalid(`${path} : niveau de titre 2 ou 3 attendu`);
			return withContent(
				{ type: 'heading', attrs: { level } },
				inlines(node.content, state, depth + 1, path)
			);
		}
		case 'blockquote':
			return { type: 'blockquote', content: blocks(node.content, state, depth + 1, path) };
		case 'bulletList':
			return { type: 'bulletList', content: listItems(node.content, state, depth + 1, path) };
		case 'orderedList': {
			const start = node.attrs === undefined ? 1 : asObject(node.attrs, `${path}.attrs`).start;
			if (!Number.isInteger(start) || (start as number) < 0 || (start as number) > 100_000) {
				throw new Invalid(`${path} : numéro de départ invalide`);
			}
			return {
				type: 'orderedList',
				attrs: { start: start as number },
				content: listItems(node.content, state, depth + 1, path)
			};
		}
		case 'codeBlock': {
			const content = asArray(node.content, `${path}.content`, true).map((item, i) => {
				const text = textNode(item, state, depth + 1, `${path}[${i}]`);
				if (text.marks) throw new Invalid(`${path} : pas de mise en forme dans un bloc de code`);
				return text;
			});
			return withContent({ type: 'codeBlock' }, content);
		}
		case 'horizontalRule':
			return { type: 'horizontalRule' };
		case 'mathBlock':
			return { type: 'mathBlock', attrs: { latex: latex(node, path, true) } };
		case 'callout': {
			const variant = asObject(node.attrs, `${path}.attrs`).variant;
			if (!CALLOUT_VARIANTS.includes(variant as CalloutVariant)) {
				throw new Invalid(`${path} : type d’encadré inconnu`);
			}
			return {
				type: 'callout',
				attrs: { variant: variant as CalloutVariant },
				content: blocks(node.content, state, depth + 1, path)
			};
		}
		case 'warningBlock': {
			const warnings = asArray(asObject(node.attrs, `${path}.attrs`).warnings, `${path}.warnings`);
			if (
				warnings.length === 0 ||
				!warnings.every((w) => (CONTENT_WARNINGS as readonly unknown[]).includes(w)) ||
				new Set(warnings).size !== warnings.length
			) {
				throw new Invalid(`${path} : avertissements attendus (liste fermée, sans doublon)`);
			}
			return {
				type: 'warningBlock',
				// Ordre canonique : le document signé ne dépend pas de l'ordre des clics.
				attrs: { warnings: CONTENT_WARNINGS.filter((w) => warnings.includes(w)) },
				content: blocks(node.content, state, depth + 1, path)
			};
		}
		case 'columns':
			return { type: 'columns', content: columns(node, state, depth, path) };
		case 'table':
			return { type: 'table', content: table(node, state, depth, path) };
		case 'timeline':
			return { type: 'timeline', attrs: { events: timelineEvents(node, path) } };
		case 'diagram':
			return { type: 'diagram', attrs: diagramAttrs(node, path) };
		default:
			throw new Invalid(`${path} : bloc « ${String(node.type)} » non pris en charge`);
	}
}

function withContent<T extends object, C>(node: T, content: C[]): T & { content?: C[] } {
	return content.length > 0 ? { ...node, content } : node;
}

function listItems(value: unknown, state: State, depth: number, path: string): ListItemNode[] {
	const list = asArray(value, `${path}.content`);
	if (list.length === 0) throw new Invalid(`${path} : liste vide`);
	return list.map((item, i) => {
		const node = asObject(item, `${path}[${i}]`);
		count(state, depth, path);
		if (node.type !== 'listItem') throw new Invalid(`${path}[${i}] : élément de liste attendu`);
		return { type: 'listItem', content: blocks(node.content, state, depth + 1, `${path}[${i}]`) };
	});
}

function latex(node: Record<string, unknown>, path: string, multiline: boolean): string {
	const value = asObject(node.attrs, `${path}.attrs`).latex;
	return attrText(value, LIMITS.maxLatexLength, `${path} : formule`, { required: true, multiline });
}

function columns(node: Record<string, unknown>, state: State, depth: number, path: string) {
	const list = asArray(node.content, `${path}.content`);
	if (list.length < LIMITS.minColumns || list.length > LIMITS.maxColumns) {
		throw new Invalid(`${path} : ${LIMITS.minColumns} ou ${LIMITS.maxColumns} colonnes attendues`);
	}
	return list.map((item, i): ColumnNode => {
		const column = asObject(item, `${path}[${i}]`);
		count(state, depth + 1, path);
		if (column.type !== 'column') throw new Invalid(`${path}[${i}] : colonne attendue`);
		return { type: 'column', content: blocks(column.content, state, depth + 2, `${path}[${i}]`) };
	});
}

/** Les cellules fusionnées ne sont pas prises en charge : `colspan` et `rowspan` valent 1. */
function cellSpan(attrs: unknown, key: 'colspan' | 'rowspan', path: string) {
	if (attrs === undefined || attrs === null) return;
	const span = asObject(attrs, `${path}.attrs`)[key];
	if (span !== undefined && span !== null && span !== 1) {
		throw new Invalid(`${path} : cellules fusionnées non prises en charge`);
	}
}

function table(node: Record<string, unknown>, state: State, depth: number, path: string) {
	const rows = asArray(node.content, `${path}.content`);
	if (rows.length === 0 || rows.length > LIMITS.maxTableRows) {
		throw new Invalid(`${path} : de 1 à ${LIMITS.maxTableRows} lignes attendues`);
	}
	let width = -1;
	return rows.map((item, r): TableRowNode => {
		const row = asObject(item, `${path}[${r}]`);
		count(state, depth + 1, path);
		if (row.type !== 'tableRow') throw new Invalid(`${path}[${r}] : ligne attendue`);
		const cells = asArray(row.content, `${path}[${r}].content`);
		if (cells.length === 0 || cells.length > LIMITS.maxTableColumns) {
			throw new Invalid(`${path}[${r}] : de 1 à ${LIMITS.maxTableColumns} colonnes attendues`);
		}
		if (width === -1) width = cells.length;
		else if (cells.length !== width)
			throw new Invalid(`${path}[${r}] : lignes de longueur inégale`);
		return {
			type: 'tableRow',
			content: cells.map((cellValue, c): TableCellNode => {
				const cellPath = `${path}[${r}][${c}]`;
				const cell = asObject(cellValue, cellPath);
				count(state, depth + 2, cellPath);
				if (cell.type !== 'tableCell' && cell.type !== 'tableHeader') {
					throw new Invalid(`${cellPath} : cellule attendue`);
				}
				cellSpan(cell.attrs, 'colspan', cellPath);
				cellSpan(cell.attrs, 'rowspan', cellPath);
				const content = asArray(cell.content, `${cellPath}.content`);
				if (content.length === 0) throw new Invalid(`${cellPath} : cellule vide`);
				return {
					type: cell.type,
					content: content.map((paragraphValue, p) => {
						const inner = asObject(paragraphValue, `${cellPath}[${p}]`);
						count(state, depth + 3, cellPath);
						if (inner.type !== 'paragraph') {
							throw new Invalid(`${cellPath}[${p}] : une cellule ne contient que des paragraphes`);
						}
						return paragraph(inner, state, depth + 3, `${cellPath}[${p}]`);
					})
				};
			})
		};
	});
}

function timelineEvents(node: Record<string, unknown>, path: string): TimelineEvent[] {
	const events = asArray(asObject(node.attrs, `${path}.attrs`).events, `${path}.events`);
	if (events.length === 0 || events.length > LIMITS.maxTimelineEvents) {
		throw new Invalid(`${path} : de 1 à ${LIMITS.maxTimelineEvents} événements attendus`);
	}
	return events.map((item, i) => {
		const event = asObject(item, `${path}.events[${i}]`);
		const at = `${path}.events[${i}]`;
		return {
			date: attrText(event.date, LIMITS.maxTimelineDate, `${at}.date`, { required: true }),
			title: attrText(event.title, LIMITS.maxTimelineTitle, `${at}.title`, { required: true }),
			text: attrText(event.text, LIMITS.maxTimelineText, `${at}.text`, { required: false })
		};
	});
}

function diagramAttrs(node: Record<string, unknown>, path: string) {
	const attrs = asObject(node.attrs, `${path}.attrs`);
	const rawNodes = asArray(attrs.nodes, `${path}.nodes`);
	if (rawNodes.length === 0 || rawNodes.length > LIMITS.maxDiagramNodes) {
		throw new Invalid(`${path} : de 1 à ${LIMITS.maxDiagramNodes} éléments attendus`);
	}
	const nodes = rawNodes.map((name, i) =>
		attrText(name, LIMITS.maxDiagramLabel, `${path}.nodes[${i}]`, { required: true })
	);
	if (new Set(nodes).size !== nodes.length) throw new Invalid(`${path} : éléments en double`);
	const rawEdges = asArray(attrs.edges, `${path}.edges`);
	if (rawEdges.length > LIMITS.maxDiagramEdges) {
		throw new Invalid(`${path} : ${LIMITS.maxDiagramEdges} relations au plus`);
	}
	const seen = new Set<string>();
	const edges = rawEdges.map((item, i): DiagramEdge => {
		const edge = asObject(item, `${path}.edges[${i}]`);
		const { from, to } = edge;
		const known = (n: unknown) =>
			Number.isInteger(n) && (n as number) >= 0 && (n as number) < nodes.length;
		if (!known(from) || !known(to)) throw new Invalid(`${path}.edges[${i}] : élément inconnu`);
		if (from === to) throw new Invalid(`${path}.edges[${i}] : relation d’un élément avec lui-même`);
		const key = `${from as number}>${to as number}`;
		if (seen.has(key)) throw new Invalid(`${path}.edges[${i}] : relation en double`);
		seen.add(key);
		return {
			from: from as number,
			to: to as number,
			label: attrText(edge.label, LIMITS.maxDiagramLabel, `${path}.edges[${i}].label`, {
				required: false
			})
		};
	});
	return { nodes, edges };
}

function inlines(value: unknown, state: State, depth: number, path: string): InlineNode[] {
	return asArray(value, `${path}.content`, true).map((item, i) => {
		const node = asObject(item, `${path}[${i}]`);
		if (node.type === 'hardBreak') {
			count(state, depth, path);
			return { type: 'hardBreak' };
		}
		if (node.type === 'mathInline') {
			count(state, depth, path);
			return { type: 'mathInline', attrs: { latex: latex(node, `${path}[${i}]`, false) } };
		}
		return textNode(node, state, depth, `${path}[${i}]`);
	});
}

function textNode(value: unknown, state: State, depth: number, path: string): TextNode {
	const node = asObject(value, path);
	count(state, depth, path);
	if (node.type !== 'text' || typeof node.text !== 'string' || node.text.length === 0) {
		throw new Invalid(`${path} : texte attendu`);
	}
	state.text += node.text.length;
	if (state.text > LIMITS.maxTextLength) throw new Invalid('texte trop long');
	const marks = asArray(node.marks, `${path}.marks`, true).map((item, i) =>
		mark(item, `${path}.marks[${i}]`)
	);
	const types = marks.map((m) => m.type);
	if (new Set(types).size !== types.length) throw new Invalid(`${path} : marque en double`);
	return marks.length > 0
		? { type: 'text', text: node.text, marks }
		: { type: 'text', text: node.text };
}

function mark(value: unknown, path: string): Mark {
	const node = asObject(value, path);
	if (typeof node.type === 'string' && SIMPLE_MARKS.has(node.type)) {
		return { type: node.type as 'bold' };
	}
	if (node.type === 'sourceRef') {
		const source = asObject(node.attrs, `${path}.attrs`).source;
		if (typeof source !== 'string' || !/^s[1-9][0-9]?$/.test(source)) {
			throw new Invalid(`${path} : renvoi de source invalide`);
		}
		return { type: 'sourceRef', attrs: { source } };
	}
	if (node.type === 'link') {
		const href = asObject(node.attrs, `${path}.attrs`).href;
		if (typeof href !== 'string' || !isSafeHref(href)) throw new Invalid(`${path} : lien refusé`);
		return { type: 'link', attrs: { href } };
	}
	throw new Invalid(`${path} : marque « ${String(node.type)} » non prise en charge`);
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (typeof value === 'object' && value !== null) {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, sortKeys((value as Record<string, unknown>)[key])])
		);
	}
	return value;
}

/** Texte brut du document (recherche plein texte, extraits), un bloc par ligne. */
export function plainText(doc: DocNode): string {
	const lines: string[] = [];
	const inline = (content: readonly InlineNode[] | undefined) =>
		(content ?? [])
			.map((node) =>
				node.type === 'text' ? node.text : node.type === 'mathInline' ? node.attrs.latex : '\n'
			)
			.join('');
	const walk = (nodes: readonly unknown[]) => {
		for (const node of nodes as (BlockNode | ListItemNode | TableRowNode | TableCellNode)[]) {
			switch (node.type) {
				case 'horizontalRule':
					break;
				case 'paragraph':
				case 'heading':
					lines.push(inline(node.content));
					break;
				case 'codeBlock':
					lines.push((node.content ?? []).map((text) => text.text).join(''));
					break;
				case 'mathBlock':
					lines.push(node.attrs.latex);
					break;
				case 'timeline':
					for (const event of node.attrs.events) {
						lines.push([event.date, event.title, event.text].filter(Boolean).join(' '));
					}
					break;
				case 'diagram':
					lines.push(...node.attrs.nodes);
					lines.push(...node.attrs.edges.map((edge) => edge.label).filter(Boolean));
					break;
				default:
					// Conteneurs : citation, listes, encadré, colonnes, tableau.
					walk(node.content);
			}
		}
	};
	walk(doc.content);
	return lines.join('\n');
}

/** Nombre de liens (sert à étiqueter « non sourcé » un texte de type « fait », D04). */
export function countLinks(doc: DocNode): number {
	let links = 0;
	const walk = (nodes: readonly unknown[]) => {
		for (const node of nodes as { content?: unknown[]; marks?: Mark[] }[]) {
			links += node.marks?.filter((m) => m.type === 'link').length ?? 0;
			if (node.content) walk(node.content);
		}
	};
	walk(doc.content);
	return links;
}

/** Identifiants des sources citées dans le corps, sans doublon, dans l'ordre d'apparition. */
export function sourceRefs(doc: DocNode): string[] {
	const refs: string[] = [];
	const walk = (nodes: readonly unknown[]) => {
		for (const node of nodes as { content?: unknown[]; marks?: Mark[] }[]) {
			for (const m of node.marks ?? []) {
				if (m.type === 'sourceRef' && !refs.includes(m.attrs.source)) refs.push(m.attrs.source);
			}
			if (node.content) walk(node.content);
		}
	};
	walk(doc.content);
	return refs;
}
