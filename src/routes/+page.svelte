<script lang="ts">
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { identity } from '#lib/client/identity.svelte.js';

	// Connecté, on n'a plus rien à découvrir ici : direction les disciplines.
	$effect(() => {
		if (identity.status === 'unlocked') void goto(href('/disciplines'), { replaceState: true });
	});

	const pillars = [
		[m.landing_pillar_text_title(), m.landing_pillar_text_body()],
		[m.landing_pillar_links_title(), m.landing_pillar_links_body()],
		[m.landing_pillar_anon_title(), m.landing_pillar_anon_body()]
	];
</script>

<svelte:head>
	<title>Maieutik</title>
	<meta name="description" content={m.landing_lead()} />
</svelte:head>

<!-- Landing : tient dans la hauteur de l'écran avec l'en-tête et le pied de page. -->
<main class="landing">
	<div class="hero">
		<h1>{m.landing_title()}</h1>
		<p class="lead">{m.landing_lead()}</p>
		<div class="actions">
			<a class="button" href={href('/disciplines')}>{m.landing_cta_explore()}</a>
			<a class="button secondary" href={href('/identite')}>{m.landing_cta_write()}</a>
		</div>
	</div>

	<ul class="pillars">
		{#each pillars as [title, body] (title)}
			<li>
				<h2>{title}</h2>
				<p>{body}</p>
			</li>
		{/each}
	</ul>
</main>

<style>
	.landing {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: clamp(1.5rem, 5vh, 3.5rem);
		padding: clamp(1.5rem, 5vh, 3rem) clamp(1rem, 4vw, 2.5rem);
	}
	.hero {
		max-width: 46rem;
		margin: 0 auto;
		text-align: center;
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 5.5vw, 3.6rem);
	}
	.lead {
		margin: var(--space-4) auto 0;
		max-width: 36rem;
		font-size: clamp(1rem, 2.2vw, 1.2rem);
		color: var(--muted);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-3);
		margin-top: var(--space-5);
	}
	.pillars {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-4);
		width: 100%;
		max-width: 60rem;
		margin: 0 auto;
		padding: 0;
		list-style: none;
	}
	.pillars li {
		padding: var(--space-4) var(--space-5);
		border-top: 2px solid var(--ink);
	}
	.pillars h2 {
		margin: 0 0 var(--space-1);
		font-size: var(--text-read);
	}
	.pillars p {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--muted);
	}
	@media (max-width: 48rem) {
		.pillars {
			grid-template-columns: 1fr;
			gap: 0;
		}
		.pillars li {
			padding: var(--space-2) 0;
			border-top-width: 1px;
		}
		.pillars h2 {
			margin: 0;
			font-size: var(--text-sm);
		}
		.pillars p {
			display: none;
		}
	}
	@media (max-height: 40rem) and (min-width: 48rem) {
		.pillars p {
			display: none;
		}
	}
</style>
