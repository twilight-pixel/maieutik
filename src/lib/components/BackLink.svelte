<!--
	Lien « Retour » vers la page parente. Il suit le défilement :
	- écran large : chevron dans la marge gauche, hors de la colonne de contenu ;
	- écran étroit (pas de marge) : barre collée en haut de la page.
	Pas d'historique du navigateur : le Referrer-Policy est « no-referrer » et la lecture doit
	fonctionner sans JavaScript.
-->
<script lang="ts">
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';

	let { to }: { to: string } = $props();
</script>

<p class="back">
	<a href={href(to)} title={m.nav_back()}>
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M15 5l-7 7 7 7" />
		</svg>
		<span class="label">{m.nav_back()}</span>
	</a>
</p>

<style>
	.back {
		position: sticky;
		top: 0;
		z-index: 1;
		margin: 0 0 var(--space-3);
		padding: var(--space-1) 0;
		background: var(--paper);
		text-align: left;
		font-size: var(--text-sm);
	}
	.back a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.25rem;
		color: var(--muted);
		text-decoration: none;
	}
	.back a:hover {
		color: var(--ink);
		text-decoration: underline;
	}
	svg {
		width: 1.25rem;
		height: 1.25rem;
	}
	/* La marge du contenu (4vw, 2.5rem au plus) accueille la pastille à partir de cette largeur. */
	@media (min-width: 62.5rem) {
		.back {
			top: 1rem;
			height: 0;
			margin: 0;
			padding: 0;
			background: none;
		}
		.back a {
			position: absolute;
			top: 0;
			right: 100%;
			justify-content: flex-start;
			width: 2rem;
			/* L'écart grandit avec la marge disponible (colonne centrée à 80 rem), jusqu'à 3 rem. */
			margin-right: clamp(0.5rem, calc(50vw - 40rem), 3rem);
			color: var(--muted);
		}
		.back a:hover {
			color: var(--ink);
			text-decoration: none;
		}
		svg {
			width: 2rem;
			height: 2rem;
		}
		.label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}
</style>
