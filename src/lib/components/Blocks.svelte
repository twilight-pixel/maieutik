<!--
	Rendu d'un document à partir de son arbre de blocs (docs/06). Jamais de HTML brut :
	chaque nœud autorisé par src/lib/shared/blocks.ts a son élément ici.
	Seule exception, justifiée dans Math.svelte : la sortie de KaTeX pour les formules.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { calloutLabel } from '#lib/i18n.js';
	import type { BlockNode, InlineNode, ListItemNode, Mark } from '#lib/shared/blocks.js';
	import { headingId } from '#lib/shared/reading.js';
	import Self from './Blocks.svelte';
	import WarningGate from './WarningGate.svelte';
	import DiagramView from './DiagramView.svelte';
	import MathView from './Math.svelte';
	import TimelineView from './TimelineView.svelte';

	// `anchors` pose un id sur les titres de premier niveau (cibles du sommaire, src/lib/shared/reading.ts).
	let { nodes, anchors = false }: { nodes: (BlockNode | ListItemNode)[]; anchors?: boolean } =
		$props();
</script>

{#snippet marked(text: string, marks: Mark[], i: number)}
	{#if i >= marks.length}{text}{:else}
		{@const mark = marks[i]}
		{#if mark.type === 'bold'}<strong>{@render marked(text, marks, i + 1)}</strong>
		{:else if mark.type === 'italic'}<em>{@render marked(text, marks, i + 1)}</em>
		{:else if mark.type === 'underline'}<u>{@render marked(text, marks, i + 1)}</u>
		{:else if mark.type === 'strike'}<s>{@render marked(text, marks, i + 1)}</s>
		{:else if mark.type === 'code'}<code>{@render marked(text, marks, i + 1)}</code>
		{:else if mark.type === 'link'}
			<!-- Lien externe : aucune information de provenance transmise (docs/03). -->
			<a href={mark.attrs.href} rel="external noopener noreferrer nofollow ugc"
				>{@render marked(text, marks, i + 1)}</a
			>
		{:else if mark.type === 'sourceRef'}
			<!-- Renvoi vers la référence structurée, listée sous le texte. -->
			{@render marked(text, marks, i + 1)}<sup class="source-ref"
				><a href="#source-{mark.attrs.source}">[{mark.attrs.source.slice(1)}]</a></sup
			>
		{/if}
	{/if}
{/snippet}

{#snippet inlines(content: InlineNode[] | undefined)}
	{#each content ?? [] as inline, i (i)}
		{#if inline.type === 'hardBreak'}<br />
		{:else if inline.type === 'mathInline'}<MathView latex={inline.attrs.latex} />
		{:else}{@render marked(inline.text, inline.marks ?? [], 0)}{/if}
	{/each}
{/snippet}

{#each nodes as node, i (i)}
	{#if node.type === 'paragraph'}
		<p>{@render inlines(node.content)}</p>
	{:else if node.type === 'heading'}
		{@const id = anchors ? headingId(i) : undefined}
		{#if node.attrs.level === 2}<h2 {id}>{@render inlines(node.content)}</h2>
		{:else}<h3 {id}>{@render inlines(node.content)}</h3>{/if}
	{:else if node.type === 'blockquote'}
		<blockquote><Self nodes={node.content} /></blockquote>
	{:else if node.type === 'bulletList'}
		<ul><Self nodes={node.content} /></ul>
	{:else if node.type === 'orderedList'}
		<ol start={node.attrs.start}><Self nodes={node.content} /></ol>
	{:else if node.type === 'listItem'}
		<li><Self nodes={node.content} /></li>
	{:else if node.type === 'codeBlock'}
		<pre><code>{(node.content ?? []).map((t) => t.text).join('')}</code></pre>
	{:else if node.type === 'horizontalRule'}
		<hr />
	{:else if node.type === 'mathBlock'}
		<MathView latex={node.attrs.latex} display />
	{:else if node.type === 'callout'}
		<div class="callout callout-{node.attrs.variant}" role="note">
			<p class="callout-title">{calloutLabel(node.attrs.variant)}</p>
			<Self nodes={node.content} />
		</div>
	{:else if node.type === 'warningBlock'}
		<!-- Avertissement sur un passage : mêmes préférences de lecture que pour un texte entier. -->
		<WarningGate warnings={node.attrs.warnings}><Self nodes={node.content} /></WarningGate>
	{:else if node.type === 'columns'}
		<div class="columns columns-{node.content.length}">
			{#each node.content as column, c (c)}
				<div class="column"><Self nodes={column.content} /></div>
			{/each}
		</div>
	{:else if node.type === 'table'}
		<!-- Le tableau défile dans sa zone : elle doit être atteignable au clavier. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="table-scroll" role="region" aria-label={m.blk_table()} tabindex="0">
			<table>
				<tbody>
					{#each node.content as row, r (r)}
						<tr>
							{#each row.content as cell, c (c)}
								{#if cell.type === 'tableHeader'}
									<th scope={r === 0 ? 'col' : 'row'}><Self nodes={cell.content} /></th>
								{:else}
									<td><Self nodes={cell.content} /></td>
								{/if}
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if node.type === 'timeline'}
		<TimelineView events={node.attrs.events} />
	{:else if node.type === 'diagram'}
		<DiagramView data={node.attrs} />
	{/if}
{/each}

<style>
	.callout {
		margin: var(--space-5) 0;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--line);
		border-left: 4px solid var(--ink);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.callout-warning {
		border-left-color: var(--danger);
	}
	.callout-title {
		margin: 0 0 var(--space-1);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.callout-warning .callout-title {
		color: var(--danger);
	}
	.callout > :global(:last-child) {
		margin-bottom: 0;
	}
	.columns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
		gap: var(--space-4) var(--space-5);
		margin: var(--space-5) 0;
	}
	.column {
		min-width: 0;
		padding: 0 0 0 var(--space-4);
		border-left: 2px solid var(--line);
	}
	.column > :global(:first-child) {
		margin-top: 0;
	}
	.column > :global(:last-child) {
		margin-bottom: 0;
	}
	.table-scroll {
		overflow-x: auto;
		margin: var(--space-5) 0;
	}
	table {
		border-collapse: collapse;
		min-width: 100%;
		font-size: 0.95em;
	}
	th,
	td {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		text-align: left;
		vertical-align: top;
	}
	th {
		background: var(--surface);
		font-weight: 650;
	}
	th :global(p),
	td :global(p) {
		margin: 0;
	}
</style>
