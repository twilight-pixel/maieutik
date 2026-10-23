<!--
	Nature d'une relation argumentative : un glyphe, un libellé et une couleur. L'information
	ne repose jamais sur la couleur seule (glyphe et texte la portent aussi), et les couleurs
	respectent le contraste AA dans les trois thèmes (theme.spec.ts).
-->
<script lang="ts">
	import { relationShortLabel } from '#lib/i18n.js';
	import type { RelationKind } from '#lib/shared/content.js';

	let { kind, label }: { kind: RelationKind; label?: string } = $props();

	// Jeton de couleur de chaque relation (src/app.css, --rel-*).
	const tone: Record<RelationKind, string> = {
		refutes: 'refutes',
		complements: 'complements',
		'provides-evidence': 'evidence',
		reinterprets: 'reinterprets',
		'replies-to': 'replies',
		'translation-of': 'translation'
	};

	// Un tracé par relation : croix, plus, coche, flèche circulaire, flèche de réponse, double flèche.
	const glyph: Record<RelationKind, string[]> = {
		refutes: ['M6 6l12 12M18 6L6 18'],
		complements: ['M12 5v14M5 12h14'],
		'provides-evidence': ['M5 12.5l4.5 4.5L19 7.5'],
		reinterprets: ['M20 12a8 8 0 1 1-2.5-5.8', 'M20 4v4h-4'],
		'replies-to': ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 0 1 6 6v3'],
		'translation-of': ['M4 8h13l-3-3', 'M20 16H7l3 3']
	};
</script>

<span class="rel" style:--rel="var(--rel-{tone[kind]})">
	<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
		{#each glyph[kind] as d (d)}<path {d} />{/each}
	</svg>
	{label ?? relationShortLabel(kind)}
</span>

<style>
	.rel {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0.05rem var(--space-2) 0.05rem var(--space-2);
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--rel) 12%, transparent);
		color: var(--rel);
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
		white-space: nowrap;
	}
	svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
