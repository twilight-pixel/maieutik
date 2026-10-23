/**
 * Extensions Tiptap de l'éditeur enrichi (D17) : formules, encadrés, colonnes, frises, schémas.
 * Les tableaux viennent de @tiptap/extension-table, restreints au schéma de blocs
 * (src/lib/shared/blocks.ts : pas de cellules fusionnées, que des paragraphes dans une cellule).
 *
 * Navigateur uniquement. Les blocs sans contenu éditable (formule, frise, schéma) s'affichent
 * avec les mêmes composants Svelte que la lecture : l'aperçu est fidèle au rendu publié.
 */
import { mount, unmount, type Component } from 'svelte';
import {
	InputRule,
	Mark,
	Node,
	findParentNode,
	mergeAttributes,
	wrappingInputRule
} from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { Fragment } from '@tiptap/pm/model';
import { NodeSelection, Selection } from '@tiptap/pm/state';
import { TableCell, TableHeader } from '@tiptap/extension-table';
import { calloutLabel, warningLabel } from '#lib/i18n.js';
import DiagramView from '#lib/components/DiagramView.svelte';
import MathView from '#lib/components/Math.svelte';
import TimelineView from '#lib/components/TimelineView.svelte';
import type { CalloutVariant, DiagramEdge, TimelineEvent } from '#lib/shared/blocks.js';
import type { ContentWarning } from '#lib/shared/content.js';

/** Marque de renvoi vers une source structurée (`s1`, `s2`…), cf. src/lib/shared/blocks.ts. */
export const SourceRef = Mark.create({
	name: 'sourceRef',
	inclusive: false,
	addAttributes() {
		return {
			source: {
				default: null,
				parseHTML: (element) => element.getAttribute('data-source'),
				renderHTML: (attributes) => ({ 'data-source': attributes.source })
			}
		};
	},
	parseHTML() {
		return [{ tag: 'span[data-source]' }];
	},
	renderHTML({ HTMLAttributes }) {
		return ['span', { ...HTMLAttributes, class: 'source-ref-mark' }, 0];
	}
});

// --- Tableaux : cellules limitées aux paragraphes ---------------------------------------------

export const RestrictedTableCell = TableCell.extend({ content: 'paragraph+' });
export const RestrictedTableHeader = TableHeader.extend({ content: 'paragraph+' });

// --- Blocs sans contenu éditable : aperçu par un composant Svelte ------------------------------

/**
 * Vue d'un nœud « atome » : monte un composant Svelte dans un conteneur non éditable.
 * Les propriétés sont réactives : `update` les met à jour sans remonter le composant.
 */
function atomView<P extends Record<string, unknown>>(
	className: string,
	component: Component<P>,
	toProps: (attrs: Record<string, unknown>) => P,
	tag: 'div' | 'span' = 'div'
) {
	return ({ node }: { node: { type: unknown; attrs: Record<string, unknown> } }) => {
		const dom = document.createElement(tag);
		dom.className = className;
		dom.contentEditable = 'false';
		const props = $state(toProps(node.attrs));
		const app = mount(component, { target: dom, props });
		let type = node.type;
		return {
			dom,
			update(updated: { type: unknown; attrs: Record<string, unknown> }) {
				if (updated.type !== type) return false;
				Object.assign(props, toProps(updated.attrs));
				type = updated.type;
				return true;
			},
			destroy() {
				void unmount(app);
			}
		};
	};
}

function jsonAttribute(name: string, fallback: unknown) {
	return {
		default: fallback,
		parseHTML: (element: HTMLElement) => {
			try {
				const value = JSON.parse(element.getAttribute(`data-${name}`) ?? 'null');
				return value ?? fallback;
			} catch {
				return fallback;
			}
		},
		renderHTML: (attributes: Record<string, unknown>) => ({
			[`data-${name}`]: JSON.stringify(attributes[name])
		})
	};
}

const latexAttribute = {
	default: '',
	parseHTML: (element: HTMLElement) => element.getAttribute('data-latex') ?? '',
	renderHTML: (attributes: Record<string, unknown>) => ({ 'data-latex': attributes.latex })
};

/** Formule dans une ligne de texte. `$x^2$` crée une formule, comme en Markdown. */
export const MathInline = Node.create({
	name: 'mathInline',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addAttributes() {
		return { latex: latexAttribute };
	},
	parseHTML() {
		return [{ tag: 'span[data-math-inline]' }];
	},
	renderHTML({ HTMLAttributes }) {
		return ['span', mergeAttributes(HTMLAttributes, { 'data-math-inline': '' })];
	},
	addNodeView() {
		return atomView(
			'math-atom math-inline',
			MathView,
			(attrs) => ({ latex: String(attrs.latex), display: false }),
			'span'
		);
	},
	addInputRules() {
		return [
			new InputRule({
				// Ni espace après le « $ » ouvrant ni avant le fermant ; « \$ » et « $$ » sont exclus.
				find: /(?<![\\$])\$([^\s$](?:[^$\n]*[^\s$])?)\$$/,
				handler: ({ state, range, match }) => {
					state.tr.replaceWith(range.from, range.to, this.type.create({ latex: match[1] }));
				}
			})
		];
	}
});

/** Formule sur sa propre ligne. */
export const MathBlock = Node.create({
	name: 'mathBlock',
	group: 'block',
	atom: true,
	selectable: true,
	draggable: true,
	addAttributes() {
		return { latex: latexAttribute };
	},
	parseHTML() {
		return [{ tag: 'div[data-math-block]' }];
	},
	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '' })];
	},
	addNodeView() {
		return atomView('math-atom math-block-atom', MathView, (attrs) => ({
			latex: String(attrs.latex),
			display: true
		}));
	}
});

export const Timeline = Node.create({
	name: 'timeline',
	group: 'block',
	atom: true,
	selectable: true,
	draggable: true,
	addAttributes() {
		return { events: jsonAttribute('events', []) };
	},
	parseHTML() {
		return [{ tag: 'div[data-timeline]' }];
	},
	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes(HTMLAttributes, { 'data-timeline': '' })];
	},
	addNodeView() {
		return atomView('block-atom', TimelineView, (attrs) => ({
			events: attrs.events as TimelineEvent[]
		}));
	}
});

export const Diagram = Node.create({
	name: 'diagram',
	group: 'block',
	atom: true,
	selectable: true,
	draggable: true,
	addAttributes() {
		return { nodes: jsonAttribute('nodes', []), edges: jsonAttribute('edges', []) };
	},
	parseHTML() {
		return [{ tag: 'div[data-diagram]' }];
	},
	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes(HTMLAttributes, { 'data-diagram': '' })];
	},
	addNodeView() {
		return atomView('block-atom', DiagramView, (attrs) => ({
			data: { nodes: attrs.nodes as string[], edges: attrs.edges as DiagramEdge[] }
		}));
	}
});

// --- Encadré et colonnes : contenu éditable ----------------------------------------------------

/** Encadré : définition, remarque ou avertissement, autour d'un contenu quelconque. */
export const Callout = Node.create({
	name: 'callout',
	group: 'block',
	content: 'block+',
	defining: true,
	addAttributes() {
		return {
			variant: {
				default: 'remark',
				parseHTML: (element) => element.getAttribute('data-callout') ?? 'remark',
				renderHTML: (attributes) => ({ 'data-callout': attributes.variant })
			}
		};
	},
	parseHTML() {
		return [{ tag: 'div[data-callout]' }];
	},
	renderHTML({ node, HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				class: `callout callout-${node.attrs.variant}`,
				'data-label': calloutLabel(node.attrs.variant)
			}),
			0
		];
	},
	addInputRules() {
		return [
			wrappingInputRule({
				find: /^:::\s$/,
				type: this.type,
				getAttributes: () => ({ variant: 'remark' })
			})
		];
	}
});

/** Passage sous avertissement de contenu (D18) : catégories en attribut, contenu éditable. */
export const WarningBlock = Node.create({
	name: 'warningBlock',
	group: 'block',
	content: 'block+',
	defining: true,
	addAttributes() {
		return {
			warnings: {
				default: ['other'],
				parseHTML: (element) =>
					(element.getAttribute('data-warnings') ?? 'other').split(' ').filter(Boolean),
				renderHTML: (attributes) => ({
					'data-warnings': (attributes.warnings as string[]).join(' ')
				})
			}
		};
	},
	parseHTML() {
		return [{ tag: 'div[data-warnings]' }];
	},
	renderHTML({ node, HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				class: 'warning-block',
				'data-label': (node.attrs.warnings as string[]).map(warningLabel).join(', ')
			}),
			0
		];
	}
});

/** Enveloppe la sélection dans un avertissement, ou bascule une catégorie s'il existe déjà. */
export function toggleWarning(editor: Editor, warning: ContentWarning) {
	if (!editor.isActive('warningBlock')) {
		editor
			.chain()
			.focus()
			.wrapIn('warningBlock', { warnings: [warning] })
			.run();
		return;
	}
	const current = (editor.getAttributes('warningBlock').warnings as ContentWarning[]) ?? [];
	const next = current.includes(warning)
		? current.filter((w) => w !== warning)
		: [...current, warning];
	// Au moins une catégorie : retirer la dernière revient à retirer l'avertissement.
	if (next.length === 0) editor.chain().focus().lift('warningBlock').run();
	else editor.chain().focus().updateAttributes('warningBlock', { warnings: next }).run();
}

/** Contenu d'une colonne : tout bloc courant, sauf d'autres colonnes (pas d'imbrication). */
const COLUMN_CONTENT =
	'(paragraph | heading | blockquote | bulletList | orderedList | codeBlock | horizontalRule | mathBlock | callout | warningBlock | table | timeline | diagram)+';

export const Column = Node.create({
	name: 'column',
	content: COLUMN_CONTENT,
	isolating: true,
	parseHTML() {
		return [{ tag: 'div[data-column]' }];
	},
	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes(HTMLAttributes, { 'data-column': '', class: 'column' }), 0];
	}
});

export const Columns = Node.create({
	name: 'columns',
	group: 'block',
	content: 'column{2,3}',
	isolating: true,
	defining: true,
	parseHTML() {
		return [{ tag: 'div[data-columns]' }];
	},
	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes(HTMLAttributes, { 'data-columns': '', class: 'columns' }), 0];
	}
});

// --- Commandes ---------------------------------------------------------------------------------

const emptyColumn = () => ({ type: 'column', content: [{ type: 'paragraph' }] });

export function insertColumns(editor: Editor) {
	editor
		.chain()
		.focus()
		.insertContent({ type: 'columns', content: [emptyColumn(), emptyColumn()] })
		.run();
}

export const insideColumns = (editor: Editor) => editor.isActive('columns');

function currentColumn(editor: Editor) {
	return findParentNode((node) => node.type.name === 'column')(editor.state.selection);
}

export function canAddColumn(editor: Editor) {
	const column = currentColumn(editor);
	return !!column && editor.state.doc.resolve(column.pos).parent.childCount < 3;
}

export function addColumn(editor: Editor) {
	const column = currentColumn(editor);
	if (!column || !canAddColumn(editor)) return;
	editor
		.chain()
		.focus()
		.insertContentAt(column.pos + column.node.nodeSize, emptyColumn())
		.run();
}

export function canRemoveColumn(editor: Editor) {
	const column = currentColumn(editor);
	return !!column && editor.state.doc.resolve(column.pos).parent.childCount > 2;
}

export function removeColumn(editor: Editor) {
	const column = currentColumn(editor);
	if (!column || !canRemoveColumn(editor)) return;
	const first = editor.state.doc.resolve(column.pos).index() === 0;
	editor
		.chain()
		.focus()
		.command(({ tr }) => {
			tr.delete(column.pos, column.pos + column.node.nodeSize);
			// Le curseur reste dans les colonnes : colonne suivante si la première part, sinon précédente.
			tr.setSelection(Selection.near(tr.doc.resolve(column.pos), first ? 1 : -1));
			return true;
		})
		.run();
}

/** Remplace les colonnes par leur contenu, mis les uns à la suite des autres. */
export function unwrapColumns(editor: Editor) {
	const columns = findParentNode((node) => node.type.name === 'columns')(editor.state.selection);
	if (!columns) return;
	let content = Fragment.empty;
	columns.node.forEach((column) => {
		content = content.append(column.content);
	});
	editor
		.chain()
		.focus()
		.command(({ tr }) => {
			tr.replaceWith(columns.pos, columns.pos + columns.node.nodeSize, content);
			return true;
		})
		.run();
}

export function setCallout(editor: Editor, variant: CalloutVariant) {
	if (editor.isActive('callout')) {
		editor.chain().focus().updateAttributes('callout', { variant }).run();
	} else {
		editor.chain().focus().wrapIn('callout', { variant }).run();
	}
}

/** Nom du bloc structuré (formule, frise, schéma) actuellement sélectionné, s'il y en a un. */
export function selectedAtom(editor: Editor) {
	const { selection } = editor.state;
	if (!(selection instanceof NodeSelection)) return null;
	const name = selection.node.type.name;
	return ['mathInline', 'mathBlock', 'timeline', 'diagram'].includes(name)
		? { name, pos: selection.from, attrs: selection.node.attrs as Record<string, unknown> }
		: null;
}
