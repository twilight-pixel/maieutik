<!--
	Plan d'un texte long (titres de premier niveau, src/lib/shared/reading.ts).
	- variante `inline` : <details> replié au-dessus du texte, fonctionne sans JavaScript ;
	- variante `side` : colonne collante dans la marge droite, sur écran large. Le titre en
	  cours de lecture y est souligné (amélioration progressive, JavaScript seulement).
	À placer dans un parent `position: relative` de la hauteur du texte.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { Outline } from '#lib/shared/reading.js';

	let { items, variant }: { items: Outline; variant: 'inline' | 'side' } = $props();

	let active = $state<string | null>(null);

	onMount(() => {
		if (variant !== 'side') return;
		const headings = items
			.map((item) => document.getElementById(item.id))
			.filter((el): el is HTMLElement => el !== null);
		let frame = 0;
		const update = () => {
			frame = 0;
			// Dernier titre passé sous le haut de l'écran (avec une marge de lecture).
			let found: string | null = null;
			for (const heading of headings) {
				if (heading.getBoundingClientRect().top <= window.innerHeight * 0.3) found = heading.id;
			}
			active = found;
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		update();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			window.removeEventListener('scroll', onScroll);
			if (frame) cancelAnimationFrame(frame);
		};
	});
</script>

{#snippet list()}
	<ol>
		{#each items as item (item.id)}
			<li class:sub={item.level === 3}>
				<a href="#{item.id}" aria-current={active === item.id ? 'location' : undefined}
					>{item.title}</a
				>
			</li>
		{/each}
	</ol>
{/snippet}

{#if variant === 'inline'}
	<details class="inline">
		<summary>{m.toc_title()} <span class="count">({items.length})</span></summary>
		{@render list()}
	</details>
{:else}
	<aside class="side" aria-label={m.toc_title()}>
		<div class="sticky">
			<p class="title">{m.toc_title()}</p>
			{@render list()}
			<a class="top" href="#contenu"><span aria-hidden="true">↑</span> {m.toc_top()}</a>
		</div>
	</aside>
{/if}

<style>
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-sm);
		line-height: 1.4;
	}
	li {
		margin: 0;
	}
	li.sub {
		padding-left: var(--space-4);
	}
	a {
		display: block;
		padding: var(--space-1) 0 var(--space-1) var(--space-3);
		border-left: 2px solid var(--line);
		color: var(--muted);
		text-decoration: none;
	}
	a:hover {
		color: var(--ink);
	}
	a[aria-current='location'] {
		border-left-color: var(--accent);
		color: var(--ink);
		font-weight: 600;
	}

	.inline {
		margin-top: var(--space-5);
		padding: var(--space-1) var(--space-4);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.inline summary {
		padding: var(--space-2) 0;
		cursor: pointer;
		font-weight: 600;
	}
	.inline .count {
		color: var(--muted);
		font-weight: 400;
	}
	.inline ol {
		padding-bottom: var(--space-3);
	}

	.side {
		display: none;
	}
	/* En rem de media query (16 px) : la colonne de texte (≈ 41 rem) plus 2 × 15 rem de marge. */
	@media (min-width: 78rem) {
		.inline {
			display: none;
		}
		.side {
			display: block;
			position: absolute;
			inset: 0 auto 0 100%;
			width: 14rem;
			margin-left: var(--space-6);
		}
		.sticky {
			position: sticky;
			top: 1.5rem;
			max-height: calc(100dvh - 3rem);
			overflow-y: auto;
		}
		.title {
			margin: 0 0 var(--space-2);
			font-size: var(--text-xs);
			font-weight: 600;
			letter-spacing: 0.05em;
			text-transform: uppercase;
			color: var(--muted);
		}
		.top {
			margin-top: var(--space-3);
			border-left-color: transparent;
			font-size: var(--text-sm);
		}
	}
	/*
	 * Réglages de lecture plus larges (texte grand ou colonne large, menu « Aa ») : la marge
	 * droite doit être assez grande pour le plan, sinon il repasse sous l'en-tête, replié.
	 * Seuils (rem de media query, 16 px) : colonne + 2 × 17 rem de marge.
	 */
	@media (min-width: 78rem) and (max-width: 93.99rem) {
		:global(:root:is([data-text-size='l'], [data-text-size='xl'], [data-measure='wide'])) .side {
			display: none;
		}
		:global(:root:is([data-text-size='l'], [data-text-size='xl'], [data-measure='wide'])) .inline {
			display: block;
		}
	}
	@media (min-width: 78rem) and (max-width: 104.99rem) {
		:global(:root[data-measure='wide']:is([data-text-size='l'], [data-text-size='xl'])) .side {
			display: none;
		}
		:global(:root[data-measure='wide']:is([data-text-size='l'], [data-text-size='xl'])) .inline {
			display: block;
		}
	}
</style>
