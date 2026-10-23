<!--
	Schéma (D17) : dessin SVG calculé par src/lib/shared/diagram.ts, identique sur le serveur et
	dans le navigateur. Une description en texte (relations, une par ligne) accompagne le dessin.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { layoutDiagram, type DiagramData } from '#lib/shared/diagram.js';

	let { data }: { data: DiagramData } = $props();

	// Identifiant propre à cette instance : plusieurs schémas peuvent cohabiter sur la page.
	const uid = $props.id();
	const layout = $derived(layoutDiagram(data));
	const linked = $derived(new Set(data.edges.flatMap((edge) => [edge.from, edge.to])));
</script>

<figure class="diagram">
	<svg
		viewBox="0 0 {layout.width} {layout.height}"
		width={layout.width}
		height={layout.height}
		role="img"
		aria-labelledby="{uid}-title"
	>
		<title id="{uid}-title">{m.blk_diagram()}</title>
		<defs>
			<marker
				id="{uid}-arrow"
				viewBox="0 0 10 10"
				refX="9"
				refY="5"
				markerWidth="8"
				markerHeight="8"
				orient="auto-start-reverse"
			>
				<path d="M 0 0 L 10 5 L 0 10 z" class="head" />
			</marker>
		</defs>
		{#each layout.paths as edge, i (i)}
			<path d={edge.path} class="edge" marker-end="url(#{uid}-arrow)" />
		{/each}
		{#each layout.boxes as box, i (i)}
			<rect x={box.x} y={box.y} width={box.width} height={box.height} rx="8" class="box" />
			{#each box.lines as line, j (j)}
				<text
					x={box.x + box.width / 2}
					y={box.y +
						(box.height - box.lines.length * layout.lineHeight) / 2 +
						layout.lineHeight * (j + 0.78)}
					text-anchor="middle"
					class="name">{line}</text
				>
			{/each}
		{/each}
		{#each layout.paths as edge, i (i)}
			{#if edge.label}
				<text x={edge.labelX} y={edge.labelY + 4} text-anchor="middle" class="label"
					>{edge.label}</text
				>
			{/if}
		{/each}
	</svg>
	<details>
		<summary>{m.blk_diagram_description()}</summary>
		<ul>
			{#each data.edges as edge, i (i)}
				<li>
					{edge.label
						? m.blk_diagram_edge_label({
								from: data.nodes[edge.from],
								to: data.nodes[edge.to],
								label: edge.label
							})
						: m.blk_diagram_edge({ from: data.nodes[edge.from], to: data.nodes[edge.to] })}
				</li>
			{/each}
			{#each data.nodes as name, i (i)}
				{#if !linked.has(i)}<li>{name}</li>{/if}
			{/each}
		</ul>
	</details>
</figure>

<style>
	.diagram {
		margin: var(--space-5) 0;
	}
	svg {
		display: block;
		max-width: 100%;
		height: auto;
		margin: 0 auto;
		overflow: visible;
		font-family: var(--font-sans);
		font-size: 14px;
	}
	.box {
		fill: var(--diagram-bg, var(--surface));
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	.name {
		fill: var(--ink);
	}
	.edge {
		fill: none;
		stroke: var(--muted);
		stroke-width: 1.5;
	}
	.head {
		fill: var(--muted);
	}
	.label {
		fill: var(--ink);
		font-size: 12px;
		/* Contour de la couleur du fond : l'étiquette reste lisible sur le trait. */
		paint-order: stroke;
		stroke: var(--diagram-bg, var(--paper));
		stroke-width: 5px;
		stroke-linejoin: round;
	}
	details {
		margin-top: var(--space-2);
		color: var(--muted);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
	}
	summary {
		cursor: pointer;
	}
	ul {
		margin: var(--space-2) 0 0;
		padding-left: var(--space-5);
	}
</style>
