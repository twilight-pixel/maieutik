<!--
	Éditeur par blocs (Tiptap, docs/06, D17) : texte, tableaux, formules, encadrés, colonnes,
	frises, schémas et renvois vers les sources.
	La sortie est normalisée par src/lib/shared/blocks.ts avant signature.
-->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Editor, type JSONContent } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { Table, TableRow } from '@tiptap/extension-table';
	import { Placeholder } from '@tiptap/extensions';
	import katex from 'katex';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { calloutLabel, lineErrorLabel, warningLabel } from '#lib/i18n.js';
	import { CONTENT_WARNINGS } from '#lib/shared/content.js';
	import { KATEX_OPTIONS } from '#lib/math.js';
	import { CALLOUT_VARIANTS, isSafeHref, type DocNode } from '#lib/shared/blocks.js';
	import { parseDiagram, serializeDiagram } from '#lib/shared/diagram.js';
	import { parseTimeline, serializeTimeline } from '#lib/shared/timeline.js';
	import {
		Callout,
		WarningBlock,
		Column,
		Columns,
		Diagram,
		MathBlock,
		MathInline,
		RestrictedTableCell,
		RestrictedTableHeader,
		SourceRef,
		Timeline,
		addColumn,
		canAddColumn,
		canRemoveColumn,
		insertColumns,
		removeColumn,
		selectedAtom,
		setCallout,
		toggleWarning,
		unwrapColumns
	} from '#lib/client/editor-extensions.svelte.js';
	import DiagramView from './DiagramView.svelte';
	import MathView from './Math.svelte';
	import TimelineView from './TimelineView.svelte';

	let {
		initial = null,
		label,
		sourceCount = 0,
		onchange
	}: {
		initial?: DocNode | null;
		label: string;
		/** Nombre de sources déclarées : un bouton « Citer » par source. */
		sourceCount?: number;
		onchange: (doc: JSONContent) => void;
	} = $props();

	let element: HTMLDivElement;
	let editor = $state<Editor | null>(null);
	// Incrémenté à chaque transaction pour rafraîchir l'état des boutons.
	let tick = $state(0);
	let focused = $state(false);
	// Plein écran : la zone de saisie couvre la page, Échap la referme.
	let expanded = $state(false);

	const expandLabel = $derived(expanded ? m.ed_collapse() : m.ed_expand());

	$effect(() => {
		if (!expanded) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = previous);
	});

	function onWindowKey(event: KeyboardEvent) {
		if (expanded && event.key === 'Escape' && !linkOpen && !panel) {
			event.preventDefault();
			expanded = false;
			editor?.commands.focus();
		}
	}

	// Saisie du lien : un champ dans l'éditeur, plus de boîte de dialogue du navigateur.
	let linkOpen = $state(false);
	let linkUrl = $state('https://');
	// Sans passage sélectionné, il faut un texte à lier : sinon rien ne s'afficherait.
	let linkText = $state('');
	let linkNeedsText = $state(false);
	let linkError = $state('');
	let linkInput = $state<HTMLInputElement | null>(null);
	let hint = $state('');

	// Panneau de saisie d'un bloc structuré : formule, frise ou schéma (insertion ou modification).
	type Panel = {
		kind: 'math' | 'timeline' | 'diagram';
		/** Position du bloc à modifier ; `null` pour une insertion. */
		pos: number | null;
		/** Formule : dans une ligne de texte ou sur sa propre ligne. */
		display: boolean;
		text: string;
	};
	let panel = $state<Panel | null>(null);
	let panelInput = $state<HTMLTextAreaElement | null>(null);

	onMount(() => {
		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					heading: { levels: [2, 3] },
					link: {
						openOnClick: false,
						autolink: true,
						protocols: ['http', 'https'],
						isAllowedUri: (url) => isSafeHref(url)
					}
				}),
				Table.configure({ resizable: false }),
				TableRow,
				RestrictedTableHeader,
				RestrictedTableCell,
				Callout,
				WarningBlock,
				Columns,
				Column,
				MathInline,
				MathBlock,
				Timeline,
				Diagram,
				SourceRef,
				Placeholder.configure({
					placeholder: ({ editor }) => (editor.isEmpty ? m.ed_placeholder() : '')
				})
			],
			content: initial ?? '',
			editorProps: {
				attributes: {
					class: 'prose',
					role: 'textbox',
					'aria-multiline': 'true',
					'aria-label': label
				},
				// Un clic sur une formule, une frise ou un schéma ouvre son panneau de saisie.
				handleClickOn: (_view, _pos, node, nodePos, _event, direct) => {
					if (
						!direct ||
						!['mathInline', 'mathBlock', 'timeline', 'diagram'].includes(node.type.name)
					) {
						return false;
					}
					editor?.commands.setNodeSelection(nodePos);
					queueMicrotask(editSelected);
					return true;
				},
				handleKeyDown: (_view, event) => {
					if (event.key !== 'Enter' || !editor || !selectedAtom(editor)) return false;
					event.preventDefault();
					editSelected();
					return true;
				}
			},
			onTransaction: ({ transaction }) => {
				tick++;
				// L'indication ne vaut que tant qu'aucun passage n'est sélectionné.
				if (hint && !transaction.selection.empty) hint = '';
			},
			onFocus: () => (focused = true),
			onBlur: () => (focused = false),
			onUpdate: ({ editor }) => onchange(editor.getJSON())
		});
		onchange(editor.getJSON());
	});

	onDestroy(() => editor?.destroy());

	function isActive(name: string, attrs?: Record<string, unknown>) {
		void tick;
		return editor?.isActive(name, attrs) ?? false;
	}

	const words = $derived.by(() => {
		void tick;
		const text = editor?.getText().trim() ?? '';
		return text === '' ? 0 : text.split(/\s+/).length;
	});

	// Une source retirée emporte ses renvois : le serveur refuserait un renvoi sans source.
	$effect(() => {
		const count = sourceCount;
		if (!editor) return;
		const type = editor.schema.marks.sourceRef;
		const tr = editor.state.tr;
		editor.state.doc.descendants((node, pos) => {
			for (const mark of node.marks) {
				if (mark.type === type && Number(String(mark.attrs.source).slice(1)) > count) {
					tr.removeMark(pos, pos + node.nodeSize, mark);
				}
			}
		});
		if (tr.docChanged) editor.view.dispatch(tr);
	});

	function cite(index: number) {
		if (!editor) return;
		const attrs = { source: `s${index}` };
		// Second clic sur la même source : le renvoi est retiré.
		if (editor.isActive('sourceRef', attrs)) {
			editor.chain().focus().extendMarkRange('sourceRef').unsetMark('sourceRef').run();
			return;
		}
		if (editor.state.selection.empty) {
			hint = m.ed_cite_hint();
			return;
		}
		hint = '';
		editor.chain().focus().setMark('sourceRef', attrs).run();
	}

	async function toggleLink() {
		if (!editor) return;
		if (editor.isActive('link')) {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}
		panel = null;
		linkOpen = true;
		linkError = '';
		linkUrl = 'https://';
		linkText = '';
		linkNeedsText = editor.state.selection.empty;
		// Le champ n'existe qu'après le rendu.
		await Promise.resolve();
		linkInput?.focus();
		linkInput?.select();
	}

	function closeLink() {
		linkOpen = false;
		linkError = '';
		editor?.commands.focus();
	}

	function applyLink() {
		if (!editor) return;
		const url = linkUrl.trim();
		if (!url) return closeLink();
		if (!isSafeHref(url)) {
			linkError = m.ed_link_invalid();
			return;
		}
		if (linkNeedsText) {
			const text = linkText.trim() || url;
			editor
				.chain()
				.focus()
				.insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href: url } }] })
				.run();
		} else {
			editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
		}
		closeLink();
	}

	function onLinkKey(event: KeyboardEvent) {
		// L'éditeur vit dans un formulaire : Entrée ne doit pas le soumettre.
		if (event.key === 'Enter') {
			event.preventDefault();
			applyLink();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			closeLink();
		}
	}

	// --- Formules, frises et schémas -------------------------------------------------------

	async function openPanel(next: Panel) {
		linkOpen = false;
		panel = next;
		await Promise.resolve();
		panelInput?.focus();
	}

	/** Ouvre le panneau du bloc sélectionné (formule, frise ou schéma), ou celui d'une insertion. */
	function openFor(kind: Panel['kind']) {
		if (!editor) return;
		const atom = selectedAtom(editor);
		const wanted = kind === 'math' ? ['mathInline', 'mathBlock'] : [kind];
		if (atom && wanted.includes(atom.name)) return editSelected();
		void openPanel({ kind, pos: null, display: false, text: '' });
	}

	function editSelected() {
		if (!editor) return;
		const atom = selectedAtom(editor);
		if (!atom) return;
		if (atom.name === 'mathInline' || atom.name === 'mathBlock') {
			void openPanel({
				kind: 'math',
				pos: atom.pos,
				display: atom.name === 'mathBlock',
				text: String(atom.attrs.latex)
			});
		} else if (atom.name === 'timeline') {
			const events = atom.attrs.events as Parameters<typeof serializeTimeline>[0];
			void openPanel({
				kind: 'timeline',
				pos: atom.pos,
				display: false,
				text: serializeTimeline(events)
			});
		} else {
			const data = { nodes: atom.attrs.nodes, edges: atom.attrs.edges } as Parameters<
				typeof serializeDiagram
			>[0];
			void openPanel({
				kind: 'diagram',
				pos: atom.pos,
				display: false,
				text: serializeDiagram(data)
			});
		}
	}

	function closePanel() {
		panel = null;
		editor?.commands.focus();
	}

	/** Erreur KaTeX d'une formule, ou `null` si elle est valide. */
	function latexError(latex: string): string | null {
		try {
			katex.renderToString(latex, KATEX_OPTIONS);
			return null;
		} catch (error) {
			// `rawMessage` : le message de KaTeX sans l'extrait souligné de la formule.
			const raw = (error as { rawMessage?: unknown }).rawMessage;
			return typeof raw === 'string' ? raw : error instanceof Error ? error.message : String(error);
		}
	}

	// Résultat de l'analyse du texte saisi dans le panneau : aperçu et erreur éventuelle.
	const panelState = $derived.by(() => {
		if (!panel) return null;
		if (panel.kind === 'math') {
			const latex = panel.text.trim();
			const error = latex === '' ? '' : latexError(latex);
			return {
				kind: 'math' as const,
				latex,
				error: error === null ? '' : error,
				ok: latex !== '' && !error
			};
		}
		if (panel.kind === 'timeline') {
			const parsed = parseTimeline(panel.text);
			return {
				kind: 'timeline' as const,
				events: parsed.events,
				error: parsed.error
					? lineErrorLabel('ed_timeline_error', parsed.error.code, parsed.error.line)
					: '',
				ok: parsed.error === null
			};
		}
		const parsed = parseDiagram(panel.text);
		return {
			kind: 'diagram' as const,
			data: { nodes: parsed.nodes, edges: parsed.edges },
			error: parsed.error
				? lineErrorLabel('ed_diagram_error', parsed.error.code, parsed.error.line)
				: '',
			ok: parsed.error === null
		};
	});

	function applyPanel() {
		if (!editor || !panel || !panelState?.ok) return;
		const { pos } = panel;
		let type: string;
		let attrs: Record<string, unknown>;
		if (panelState.kind === 'math') {
			type = panel.display ? 'mathBlock' : 'mathInline';
			attrs = { latex: panelState.latex };
		} else if (panelState.kind === 'timeline') {
			type = 'timeline';
			attrs = { events: panelState.events };
		} else {
			type = 'diagram';
			attrs = { nodes: panelState.data.nodes, edges: panelState.data.edges };
		}
		if (pos === null) {
			editor.chain().focus().insertContent({ type, attrs }).run();
		} else {
			editor
				.chain()
				.focus()
				.command(({ tr }) => {
					tr.setNodeMarkup(pos, undefined, attrs);
					return true;
				})
				.run();
		}
		panel = null;
	}

	function deleteFromPanel() {
		if (!editor || !panel || panel.pos === null) return;
		const node = editor.state.doc.nodeAt(panel.pos);
		if (node) {
			editor
				.chain()
				.focus()
				.deleteRange({ from: panel.pos, to: panel.pos + node.nodeSize })
				.run();
		}
		panel = null;
	}

	function onPanelKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closePanel();
		} else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			applyPanel();
		}
	}

	// --- Barre d'outils -----------------------------------------------------------------------

	const MOD =
		typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
	const SHIFT = getLocale() === 'fr' ? 'Maj' : 'Shift';

	type Tool = {
		label: string;
		icon: string;
		/** Raccourci clavier, affiché dans l'infobulle et dans l'aide. */
		shortcut?: string;
		active?: () => boolean;
		enabled?: () => boolean;
		run: () => void;
	};
	// Tracés 24×24, trait de 2 : même famille que l'icône de thème du bandeau.
	const tools: Record<string, Tool[]> = {
		history: [
			{
				label: m.ed_undo(),
				icon: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
				shortcut: `${MOD}+Z`,
				enabled: () => (void tick, editor?.can().undo() ?? false),
				run: () => editor?.chain().focus().undo().run()
			},
			{
				label: m.ed_redo(),
				icon: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
				shortcut: `${MOD}+${SHIFT}+Z`,
				enabled: () => (void tick, editor?.can().redo() ?? false),
				run: () => editor?.chain().focus().redo().run()
			}
		],
		inline: [
			{
				label: m.ed_bold(),
				icon: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
				shortcut: `${MOD}+B`,
				active: () => isActive('bold'),
				run: () => editor?.chain().focus().toggleBold().run()
			},
			{
				label: m.ed_italic(),
				icon: 'M19 4h-9M14 20H5M15 4 9 20',
				shortcut: `${MOD}+I`,
				active: () => isActive('italic'),
				run: () => editor?.chain().focus().toggleItalic().run()
			},
			{
				label: m.ed_underline(),
				icon: 'M6 4v6a6 6 0 0 0 12 0V4M4 20h16',
				shortcut: `${MOD}+U`,
				active: () => isActive('underline'),
				run: () => editor?.chain().focus().toggleUnderline().run()
			},
			{
				label: m.ed_strike(),
				icon: 'M16 4H9a3 3 0 0 0-2.8 4M14 12a4 4 0 0 1 0 8H6M4 12h16',
				shortcut: `${MOD}+${SHIFT}+S`,
				active: () => isActive('strike'),
				run: () => editor?.chain().focus().toggleStrike().run()
			},
			{
				label: m.ed_code_inline(),
				icon: 'm16 18 6-6-6-6M8 6l-6 6 6 6',
				shortcut: `${MOD}+E`,
				active: () => isActive('code'),
				run: () => editor?.chain().focus().toggleCode().run()
			},
			{
				label: m.ed_link(),
				icon: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
				active: () => isActive('link') || linkOpen,
				run: toggleLink
			}
		],
		blocks: [
			{
				label: m.ed_h2(),
				icon: 'M4 5v14M12 5v14M4 12h8M17 10.5a2.5 2.5 0 1 1 3.9 2L17 17h5',
				shortcut: `${MOD}+Alt+2`,
				active: () => isActive('heading', { level: 2 }),
				run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run()
			},
			{
				label: m.ed_h3(),
				icon: 'M4 5v14M12 5v14M4 12h8M17 9.5h4l-2.5 3a2.5 2.5 0 1 1-2 4',
				shortcut: `${MOD}+Alt+3`,
				active: () => isActive('heading', { level: 3 }),
				run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run()
			},
			{
				label: m.ed_quote(),
				icon: 'M4 6h16M4 12h10M4 18h16M20 10v6',
				shortcut: `${MOD}+${SHIFT}+B`,
				active: () => isActive('blockquote'),
				run: () => editor?.chain().focus().toggleBlockquote().run()
			},
			{
				label: m.ed_bullet(),
				icon: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
				shortcut: `${MOD}+${SHIFT}+8`,
				active: () => isActive('bulletList'),
				run: () => editor?.chain().focus().toggleBulletList().run()
			},
			{
				label: m.ed_ordered(),
				icon: 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1',
				shortcut: `${MOD}+${SHIFT}+7`,
				active: () => isActive('orderedList'),
				run: () => editor?.chain().focus().toggleOrderedList().run()
			},
			{
				label: m.ed_code(),
				icon: 'M4 5h16v14H4zM9.5 10 7.5 12l2 2M14.5 10l2 2-2 2',
				shortcut: `${MOD}+Alt+C`,
				active: () => isActive('codeBlock'),
				run: () => editor?.chain().focus().toggleCodeBlock().run()
			},
			{
				label: m.ed_rule(),
				icon: 'M3 12h18',
				// Le séparateur remplacerait le passage sélectionné : on le pose après.
				run: () => {
					if (!editor) return;
					editor
						.chain()
						.focus()
						.setTextSelection(editor.state.selection.to)
						.setHorizontalRule()
						.run();
				}
			}
		],
		insert: [
			{
				label: m.ed_table(),
				icon: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14',
				active: () => isActive('table'),
				enabled: () => (void tick, !editor?.isActive('table')),
				run: () =>
					editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
			},
			{
				label: m.ed_math(),
				icon: 'M18 7V5H6l6 7-6 7h12v-2',
				active: () => isActive('mathInline') || isActive('mathBlock') || panel?.kind === 'math',
				run: () => openFor('math')
			},
			{
				label: m.ed_callout(),
				icon: 'M3 5h18v14H3zM12 9v.01M12 12v4',
				active: () => isActive('callout'),
				run: () => editor && setCallout(editor, 'remark')
			},
			{
				label: m.ed_warning_block(),
				icon: 'M12 3l10 18H2zM12 10v4M12 17v.01',
				active: () => isActive('warningBlock'),
				run: () => editor && toggleWarning(editor, 'other')
			},
			{
				label: m.ed_columns(),
				icon: 'M3 5h18v14H3zM12 5v14',
				active: () => isActive('columns'),
				enabled: () => (void tick, !editor?.isActive('columns')),
				run: () => editor && insertColumns(editor)
			},
			{
				label: m.ed_timeline(),
				icon: 'M12 3v18M12 6h6M12 12H6M12 18h6',
				active: () => isActive('timeline') || panel?.kind === 'timeline',
				run: () => openFor('timeline')
			},
			{
				label: m.ed_diagram(),
				icon: 'M3 4h7v5H3zM14 15h7v5h-7zM6.5 9v3a3 3 0 0 0 3 3H14',
				active: () => isActive('diagram') || panel?.kind === 'diagram',
				run: () => openFor('diagram')
			}
		]
	};
	const groups = ['history', 'inline', 'blocks', 'insert'] as const;

	// --- Barre contextuelle : options du bloc où se trouve le curseur ---------------------------

	type Action = { label: string; run: () => void; active?: boolean; enabled?: boolean };
	type Context = { title: string; actions: Action[] };

	const contexts = $derived.by((): Context[] => {
		void tick;
		const ed = editor;
		if (!ed) return [];
		const found: Context[] = [];
		const can = ed.can();
		const chain = () => ed.chain().focus();
		if (ed.isActive('table')) {
			found.push({
				title: m.ed_table(),
				actions: [
					{
						label: m.ed_row_before(),
						run: () => chain().addRowBefore().run(),
						enabled: can.addRowBefore()
					},
					{
						label: m.ed_row_after(),
						run: () => chain().addRowAfter().run(),
						enabled: can.addRowAfter()
					},
					{
						label: m.ed_row_delete(),
						run: () => chain().deleteRow().run(),
						enabled: can.deleteRow()
					},
					{
						label: m.ed_col_before(),
						run: () => chain().addColumnBefore().run(),
						enabled: can.addColumnBefore()
					},
					{
						label: m.ed_col_after(),
						run: () => chain().addColumnAfter().run(),
						enabled: can.addColumnAfter()
					},
					{
						label: m.ed_col_delete(),
						run: () => chain().deleteColumn().run(),
						enabled: can.deleteColumn()
					},
					{
						label: m.ed_header_row(),
						run: () => chain().toggleHeaderRow().run(),
						active: undefined
					},
					{
						label: m.ed_header_col(),
						run: () => chain().toggleHeaderColumn().run(),
						active: undefined
					},
					{
						label: m.ed_table_delete(),
						run: () => chain().deleteTable().run(),
						enabled: can.deleteTable()
					}
				]
			});
		}
		if (ed.isActive('columns')) {
			found.push({
				title: m.ed_columns(),
				actions: [
					{ label: m.ed_column_add(), run: () => addColumn(ed), enabled: canAddColumn(ed) },
					{
						label: m.ed_column_remove(),
						run: () => removeColumn(ed),
						enabled: canRemoveColumn(ed)
					},
					{ label: m.ed_columns_unwrap(), run: () => unwrapColumns(ed) },
					{ label: m.ed_columns_delete(), run: () => chain().deleteNode('columns').run() }
				]
			});
		}
		if (ed.isActive('callout')) {
			found.push({
				title: m.ed_callout(),
				actions: [
					...CALLOUT_VARIANTS.map((variant) => ({
						label: calloutLabel(variant),
						run: () => setCallout(ed, variant),
						active: ed.isActive('callout', { variant })
					})),
					{ label: m.ed_callout_remove(), run: () => chain().lift('callout').run() }
				]
			});
		}
		if (ed.isActive('warningBlock')) {
			const current = (ed.getAttributes('warningBlock').warnings as string[]) ?? [];
			found.push({
				title: m.ed_warning_block(),
				actions: [
					...CONTENT_WARNINGS.map((warning) => ({
						label: warningLabel(warning),
						run: () => toggleWarning(ed, warning),
						active: current.includes(warning)
					})),
					{ label: m.ed_warning_block_remove(), run: () => chain().lift('warningBlock').run() }
				]
			});
		}
		const atom = selectedAtom(ed);
		if (atom) {
			found.push({
				title: atom.name.startsWith('math')
					? m.ed_math()
					: atom.name === 'timeline'
						? m.ed_timeline()
						: m.ed_diagram(),
				actions: [
					{ label: m.ed_edit(), run: editSelected },
					{ label: m.ed_delete(), run: () => chain().deleteSelection().run() }
				]
			});
		}
		return found;
	});

	// --- Aide à la mise en forme ----------------------------------------------------------------

	/** Raccourcis Markdown : ce qu'on tape, et ce qu'on obtient (libellés de la barre d'outils). */
	const markdownStart = [
		{ typed: '##␣', does: m.ed_h2() },
		{ typed: '###␣', does: m.ed_h3() },
		{ typed: '-␣  ou  *␣', does: m.ed_bullet() },
		{ typed: '1.␣', does: m.ed_ordered() },
		{ typed: '>␣', does: m.ed_quote() },
		{ typed: '```␣', does: m.ed_code() },
		{ typed: '---', does: m.ed_rule() },
		{ typed: ':::␣', does: m.ed_callout() }
	];
	const markdownInline = [
		{ typed: '**texte**', does: m.ed_bold() },
		{ typed: '*texte*  ou  _texte_', does: m.ed_italic() },
		{ typed: '~~texte~~', does: m.ed_strike() },
		{ typed: '`texte`', does: m.ed_code_inline() },
		{ typed: '$x^2$', does: m.ed_math() }
	];
	const shortcutList = Object.values(tools)
		.flat()
		.filter((tool) => tool.shortcut);
</script>

<svelte:window onkeydown={onWindowKey} />

<div class="editor" class:focused class:expanded>
	<div class="toolbar" role="toolbar" aria-label={m.ed_toolbar()}>
		{#each groups as group (group)}
			<div class="group">
				{#each tools[group] as tool (tool.label)}
					<button
						type="button"
						title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
						aria-label={tool.label}
						aria-pressed={tool.active ? tool.active() : undefined}
						disabled={!editor || (tool.enabled ? !tool.enabled() : false)}
						onclick={tool.run}
					>
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							aria-hidden="true"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"><path d={tool.icon} /></svg
						>
					</button>
				{/each}
			</div>
		{/each}
		{#if sourceCount > 0}
			<div class="group">
				{#each Array.from({ length: sourceCount }, (_, i) => i + 1) as n (n)}
					<button
						type="button"
						class="cite"
						title={m.ed_cite({ n })}
						aria-label={m.ed_cite({ n })}
						aria-pressed={isActive('sourceRef', { source: `s${n}` })}
						disabled={!editor}
						onclick={() => cite(n)}>[{n}]</button
					>
				{/each}
			</div>
		{/if}
		<button
			type="button"
			class="expand"
			title={expandLabel}
			aria-label={expandLabel}
			aria-pressed={expanded}
			onclick={() => (expanded = !expanded)}
		>
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				aria-hidden="true"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				{#if expanded}
					<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
				{:else}
					<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
				{/if}
			</svg>
		</button>
	</div>

	{#if contexts.length > 0}
		<div class="context" role="toolbar" aria-label={m.ed_context()}>
			{#each contexts as context (context.title)}
				<div class="context-group">
					<span class="context-title">{context.title}</span>
					{#each context.actions as action (action.label)}
						<button
							type="button"
							aria-pressed={action.active}
							disabled={action.enabled === false}
							onclick={action.run}>{action.label}</button
						>
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	{#if linkOpen}
		<div class="linkbar" role="group" aria-label={m.ed_link()}>
			{#if linkNeedsText}
				<input
					type="text"
					bind:value={linkText}
					placeholder={m.ed_link_text()}
					aria-label={m.ed_link_text()}
					onkeydown={onLinkKey}
				/>
			{/if}
			<input
				type="url"
				bind:this={linkInput}
				bind:value={linkUrl}
				placeholder={m.ed_link_prompt()}
				aria-label={m.ed_link_prompt()}
				aria-invalid={linkError ? 'true' : undefined}
				onkeydown={onLinkKey}
			/>
			<button type="button" class="apply" onclick={applyLink}>{m.ed_link_apply()}</button>
			<button type="button" onclick={closeLink}>{m.ed_link_cancel()}</button>
			{#if linkError}<span class="problem" role="alert">{linkError}</span>{/if}
		</div>
	{/if}

	{#if panel && panelState}
		{@const title =
			panel.kind === 'math'
				? m.ed_math()
				: panel.kind === 'timeline'
					? m.ed_timeline()
					: m.ed_diagram()}
		{@const hintText =
			panel.kind === 'math'
				? m.ed_math_hint()
				: panel.kind === 'timeline'
					? m.ed_timeline_hint()
					: m.ed_diagram_hint()}
		<div class="panel" role="group" aria-label={title}>
			<div class="panel-input">
				<textarea
					bind:this={panelInput}
					bind:value={panel.text}
					rows={panel.kind === 'math' ? 3 : 6}
					spellcheck="false"
					aria-label={title}
					placeholder={panel.kind === 'timeline'
						? m.ed_timeline_example()
						: panel.kind === 'diagram'
							? m.ed_diagram_example()
							: '\\frac{a}{b} + x^2'}
					aria-invalid={panelState.error ? 'true' : undefined}
					onkeydown={onPanelKey}></textarea>
				<p class="panel-hint">{hintText}</p>
				{#if panel.kind === 'math' && panel.pos === null}
					<div class="choice" role="radiogroup" aria-label={m.ed_math()}>
						<label
							><input type="radio" bind:group={panel.display} value={false} />
							{m.ed_math_inline()}</label
						>
						<label
							><input type="radio" bind:group={panel.display} value={true} />
							{m.ed_math_block()}</label
						>
					</div>
				{/if}
				{#if panelState.error}
					<p class="problem" role="alert">
						{panelState.kind === 'math'
							? m.ed_math_invalid({ error: panelState.error })
							: panelState.error}
					</p>
				{/if}
			</div>
			<div class="panel-preview" aria-label={m.ed_math_preview()}>
				{#if panelState.kind === 'math' && panelState.ok}
					<MathView latex={panelState.latex} display={panel.display} />
				{:else if panelState.kind === 'timeline' && panelState.events.length > 0}
					<TimelineView events={panelState.events} />
				{:else if panelState.kind === 'diagram' && panelState.data.nodes.length > 0}
					<DiagramView data={panelState.data} />
				{/if}
			</div>
			<div class="panel-actions">
				<button type="button" class="apply" disabled={!panelState.ok} onclick={applyPanel}>
					{panel.pos === null ? m.ed_insert() : m.ed_update()}
				</button>
				{#if panel.pos !== null}
					<button type="button" onclick={deleteFromPanel}>{m.ed_delete()}</button>
				{/if}
				<button type="button" onclick={closePanel}>{m.ed_cancel()}</button>
			</div>
		</div>
	{/if}

	<div class="surface" bind:this={element}></div>

	<details class="help">
		<summary>{m.ed_help()}</summary>
		<div class="help-body">
			<section>
				<h3>{m.ed_help_start()}</h3>
				<ul>
					{#each markdownStart as row (row.typed)}
						<li><kbd>{row.typed}</kbd> <span>{row.does}</span></li>
					{/each}
				</ul>
				<h3>{m.ed_help_inline()}</h3>
				<ul>
					{#each markdownInline as row (row.typed)}
						<li><kbd>{row.typed}</kbd> <span>{row.does}</span></li>
					{/each}
				</ul>
			</section>
			<section>
				<h3>{m.ed_help_keys()}</h3>
				<ul>
					{#each shortcutList as tool (tool.label)}
						<li><kbd>{tool.shortcut}</kbd> <span>{tool.label}</span></li>
					{/each}
				</ul>
				<p>{m.ed_help_break()}</p>
				<p>{m.ed_help_table()}</p>
				<p>{m.ed_help_blocks()}</p>
			</section>
		</div>
	</details>

	<div class="status">
		<span class="hint" role="status">{hint}</span>
		<span class="count">{m.ed_words({ count: words })}</span>
	</div>
</div>

<style>
	.editor {
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		transition: border-color 0.15s;
		--diagram-bg: var(--surface);
	}
	.editor.focused {
		border-color: var(--muted);
	}
	.toolbar {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--line);
		background: var(--surface);
		border-radius: var(--radius) var(--radius) 0 0;
	}
	.group {
		display: flex;
		gap: 0.1rem;
	}
	.group + .group {
		padding-left: var(--space-2);
		border-left: 1px solid var(--line);
	}
	.toolbar button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.2rem;
		height: 2.2rem;
		padding: 0 var(--space-2);
		border: 0;
		border-radius: var(--r-sm);
		background: none;
		color: var(--ink);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.toolbar button:hover:not(:disabled, [aria-pressed='true']) {
		background: var(--paper);
	}
	.toolbar button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.toolbar button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--paper);
	}
	.toolbar .cite {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}
	.toolbar .expand {
		margin-left: auto;
	}
	.context {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		padding: var(--space-2) var(--space-2);
		border-bottom: 1px solid var(--line);
		background: var(--paper);
		font-size: var(--text-sm);
	}
	.context-group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.context-title {
		font-weight: 700;
		color: var(--muted);
	}
	.context button {
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--line);
		border-radius: var(--r-pill);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}
	.context button:hover:not(:disabled) {
		border-color: var(--muted);
	}
	.context button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.context button[aria-pressed='true'] {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--paper);
	}
	.linkbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-bottom: 1px solid var(--line);
		background: var(--paper);
	}
	.linkbar input {
		flex: 1 1 14rem;
		padding: var(--space-2) var(--space-2);
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: var(--text-sm);
	}
	.linkbar button,
	.panel-actions button {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--r-pill);
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: var(--text-sm);
		cursor: pointer;
	}
	.linkbar .apply,
	.panel-actions .apply {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
	}
	.panel-actions .apply:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.problem {
		flex-basis: 100%;
		margin: var(--space-1) 0 0;
		color: var(--danger);
		font-size: var(--text-sm);
	}
	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-3) var(--space-4);
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--line);
		background: var(--paper);
	}
	.panel-input textarea {
		width: 100%;
		padding: var(--space-2) var(--space-2);
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		background: var(--surface);
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		line-height: 1.5;
		resize: vertical;
	}
	.panel-hint {
		margin: var(--space-1) 0 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.choice {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin-top: var(--space-2);
		font-size: var(--text-sm);
	}
	.panel-preview {
		min-width: 0;
		max-height: 18rem;
		overflow: auto;
		padding: var(--space-1) var(--space-2);
		border: 1px dashed var(--line);
		border-radius: var(--r-sm);
		background: var(--surface);
	}
	.panel-preview:empty {
		display: none;
	}
	.panel-actions {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	@media (max-width: 40rem) {
		.panel {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	/*
	 * La zone de saisie grandit avec le texte : c'est la page qui défile, pas une boîte dans la
	 * page. La barre d'outils reste collée en haut de l'écran pendant la saisie d'un long texte.
	 */
	.surface {
		min-height: 0;
	}
	.editor.expanded {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		border: 0;
		border-radius: 0;
	}
	.editor.expanded .toolbar {
		border-radius: 0;
	}
	.editor.expanded .panel {
		max-height: 45%;
		overflow: auto;
	}
	.editor.expanded .surface {
		flex: 1;
		overflow: auto;
	}
	/* Mesure de lecture : les lignes restent courtes sur grand écran, alignées à gauche. */
	.editor.expanded .surface :global(.prose) {
		min-height: 100%;
		padding-right: max(2rem, calc(100% - 52rem));
	}
	.surface :global(.prose) {
		/* Toute la zone est cliquable, même sous la dernière ligne. */
		min-height: max(24rem, 60dvh);
		padding: 1.5rem clamp(1rem, 4vw, 2rem);
		outline: none;
		font-family: var(--font-reading);
		font-size: var(--text-read);
		line-height: 1.8;
		text-wrap: pretty;
	}
	.surface :global(.prose > :first-child) {
		margin-top: 0;
	}
	.surface :global(.prose h2),
	.surface :global(.prose h3) {
		margin: 1.75em 0 0.5em;
	}
	.surface :global(.prose blockquote) {
		margin: var(--space-4) 0;
		padding-left: var(--space-4);
		border-left: 3px solid var(--ink);
		color: var(--muted);
	}
	.surface :global(.prose pre) {
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--paper);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		overflow-x: auto;
	}
	.surface :global(.source-ref-mark) {
		text-decoration: underline dotted;
		background: var(--paper);
	}
	.surface :global(.prose a) {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.2em;
		cursor: text;
	}
	.surface :global(.prose code) {
		padding: 0.1em 0.3em;
		border-radius: var(--r-sm);
		background: var(--paper);
		font-family: var(--font-mono);
		font-size: 0.9em;
	}
	.surface :global(.prose pre code) {
		padding: 0;
		background: none;
		font-size: inherit;
	}
	.surface :global(.prose p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		color: var(--muted);
		float: left;
		height: 0;
		pointer-events: none;
	}
	/* Blocs enrichis dans l'éditeur. */
	.surface :global(.prose table) {
		border-collapse: collapse;
		min-width: 50%;
		margin: var(--space-4) 0;
		table-layout: fixed;
	}
	.surface :global(.prose th),
	.surface :global(.prose td) {
		position: relative;
		min-width: 4rem;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		vertical-align: top;
		text-align: left;
	}
	.surface :global(.prose th) {
		background: var(--paper);
		font-weight: 650;
	}
	.surface :global(.prose th p),
	.surface :global(.prose td p) {
		margin: 0;
	}
	.surface :global(.prose .selectedCell::after) {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--ink);
		opacity: 0.12;
		pointer-events: none;
	}
	.surface :global(.prose .warning-block) {
		position: relative;
		margin: var(--space-4) 0;
		padding: var(--space-5) var(--space-4) var(--space-2);
		border: 1px dashed var(--danger);
		border-radius: var(--radius);
	}
	.surface :global(.prose .warning-block::before) {
		content: '⚠ ' attr(data-label);
		position: absolute;
		top: 0.35rem;
		left: 1rem;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		font-weight: 700;
		color: var(--danger);
	}
	.surface :global(.prose .callout) {
		position: relative;
		margin: var(--space-5) 0;
		padding: var(--space-5) var(--space-4) var(--space-2);
		border: 1px solid var(--line);
		border-left: 4px solid var(--ink);
		border-radius: var(--radius);
		background: var(--paper);
	}
	.surface :global(.prose .callout-warning) {
		border-left-color: var(--danger);
	}
	.surface :global(.prose .callout::before) {
		content: attr(data-label);
		position: absolute;
		top: 0.35rem;
		left: 1rem;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.surface :global(.prose .columns) {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: var(--space-4);
		margin: var(--space-5) 0;
	}
	.surface :global(.prose .column) {
		min-width: 0;
		padding: 0 0 0 var(--space-3);
		border-left: 2px dashed var(--line);
	}
	.surface :global(.prose .math-inline) {
		display: inline-block;
		padding: 0 0.15rem;
		border-radius: var(--r-sm);
		cursor: pointer;
	}
	.surface :global(.prose .math-block-atom),
	.surface :global(.prose .block-atom) {
		margin: var(--space-3) 0;
		padding: 0 var(--space-2);
		border: 1px dashed transparent;
		border-radius: var(--radius);
		cursor: pointer;
	}
	.surface :global(.prose .math-atom:hover),
	.surface :global(.prose .block-atom:hover) {
		border-color: var(--line);
		background: var(--paper);
	}
	.surface :global(.prose .ProseMirror-selectednode) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
	.help {
		border-top: 1px solid var(--line);
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.help summary {
		padding: var(--space-2) var(--space-4);
		cursor: pointer;
	}
	.help-body {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--space-2) var(--space-6);
		max-height: 16rem;
		overflow: auto;
		padding: 0 var(--space-4) var(--space-3);
	}
	.help h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		font-weight: 700;
		color: var(--ink);
	}
	.help ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.help li {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
		padding: 0.1rem 0;
	}
	.help kbd {
		min-width: 6rem;
		padding: 0.05rem var(--space-2);
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		background: var(--paper);
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		white-space: nowrap;
	}
	.help p {
		margin: var(--space-2) 0 0;
	}
	.editor.expanded .help-body {
		max-height: 30vh;
	}
	.status {
		position: sticky;
		bottom: 0;
		z-index: 1;
		background: var(--surface);
		border-radius: 0 0 var(--radius) var(--radius);
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		border-top: 1px solid var(--line);
		color: var(--muted);
		font-size: var(--text-sm);
	}
	/* Sous 46 rem, la barre de navigation fixe (+layout.svelte) occupe le bas de l'écran. */
	@media (max-width: 46rem) {
		.status {
			bottom: 3.75rem;
		}
		.editor.expanded .status {
			bottom: 0;
		}
	}
	.hint {
		min-height: 1em;
	}
	.count {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
