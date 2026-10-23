<script lang="ts">
	import Icon, { type IconName } from '#lib/components/Icon.svelte';
	import JuryBadge from '#lib/components/JuryBadge.svelte';
	import NavMenu from '#lib/components/NavMenu.svelte';
	import Pastille from '#lib/components/Pastille.svelte';
	import { asset } from '$app/paths';
	import { href } from '#lib/href.js';
	import '../app.css';
	import { page } from '$app/state';
	import { deLocalizeHref, getLocale, locales } from '#lib/paraglide/runtime.js';
	import { m } from '#lib/paraglide/messages.js';
	import Logo from '#lib/components/Logo.svelte';
	import favicon from '#lib/assets/favicon.svg';
	import { initTheme, theme, toggleTheme } from '#lib/client/theme.svelte.js';
	import { identity } from '#lib/client/identity.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => initTheme());
	$effect(() => {
		identity.init();
	});

	// Connecté, le logo mène à la lecture plutôt qu'à la landing page.
	const home = $derived(identity.status === 'unlocked' ? '/disciplines' : '/');

	type Section = { path: string; label: () => string; icon: IconName };
	const explore: Section = { path: '/disciplines', label: m.nav_explore, icon: 'compass' };
	const questions: Section = { path: '/questions', label: m.nav_questions, icon: 'help' };
	const toAnswer: Section = { path: '/a-repondre', label: m.nav_to_answer, icon: 'reply' };

	// Page courante ou page d'une rubrique (/questions/nouvelle appartient à /questions).
	const path = $derived(deLocalizeHref(page.url.pathname));
	const current = (section: string) =>
		path === section ? 'page' : path.startsWith(`${section}/`) ? 'true' : undefined;

	const languageName = (locale: string) => {
		const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
		return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
	};

	const unlocked = $derived(identity.status === 'unlocked' ? identity.active : null);
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<meta name="color-scheme" content="light dark" />
	<!-- Application installable (PWA) : manifeste et icône servis par le site lui-même. -->
	<link rel="manifest" href={asset('manifest.webmanifest')} />
	<meta name="theme-color" content="#0e0e0e" />
</svelte:head>

{#snippet tab(section: Section, bar: boolean)}
	<a href={href(section.path)} aria-current={current(section.path)}>
		{#if bar}<Icon name={section.icon} size={22} />{/if}
		<span>{section.label()}</span>
	</a>
{/snippet}

<div class="shell">
	<a class="skip" href="#contenu">{m.nav_skip()}</a>
	<header>
		<div class="inner bar">
			<a class="brand" href={href(home)}>
				<Logo variant="symbol" class="logo" />
			</a>

			<!-- Rubriques de lecture (≥ 46 rem). Sur mobile, la barre du bas prend le relais. -->
			<nav class="sections" aria-label={m.nav_main()}>
				{@render tab(explore, false)}
				{@render tab(questions, false)}
				{@render tab(toAnswer, false)}
			</nav>

			<div class="actions">
				<JuryBadge />

				<a class="write" href={href('/ecrire')} aria-current={current('/ecrire')}>{m.nav_write()}</a
				>

				<a class="me" href={href('/identite')} aria-current={current('/identite')}>
					{#if unlocked}
						<span class="who"
							>{unlocked.displayName}<span class="fp">#{unlocked.fingerprint}</span></span
						>
					{:else}
						<span class="who">{m.nav_identity()}</span>
					{/if}
				</a>

				<!-- Langue, thème et préférences de lecture : un seul endroit. -->
				<NavMenu label={m.nav_settings()}>
					{#snippet trigger()}<Icon name="settings" size={20} />{/snippet}
					<p class="group" id="nav-langs">{m.nav_language()}</p>
					<div role="group" aria-labelledby="nav-langs">
						{#each locales as locale (locale)}
							<a
								class="item"
								href={href(page.url.pathname, { locale })}
								lang={locale}
								hreflang={locale}
								aria-current={locale === getLocale() ? 'true' : undefined}
							>
								<span class="tick"
									>{#if locale === getLocale()}<Icon name="check" size={16} />{/if}</span
								>{languageName(locale)}
							</a>
						{/each}
					</div>
					<hr />
					<!-- Écriture JS uniquement : sans JavaScript, le thème du système s'applique. -->
					{#if theme.current}
						<button type="button" class="item" onclick={toggleTheme}>
							<span class="tick"
								><Icon name={theme.current === 'dark' ? 'sun' : 'moon'} size={16} /></span
							>{theme.current === 'dark' ? m.theme_to_light() : m.theme_to_dark()}
						</button>
					{/if}
					<a class="item" href={href('/preferences')} aria-current={current('/preferences')}>
						<span class="tick"></span>{m.prefs_link()}
					</a>
				</NavMenu>
			</div>
		</div>
	</header>

	<!-- Cible du lien d'évitement ; boîte réelle (pas display: contents) pour que l'ancre défile. -->
	<div id="contenu" class="content" tabindex="-1">
		{@render children()}
	</div>

	<footer>
		<div class="inner foot">
			<nav aria-label={m.nav_transparency()}>
				<a href={href('/journal')}>{m.nav_moderation_log()}</a>
				<a href={href('/jurys')}>{m.jury_audit_title()}</a>
			</nav>
			<p>{m.footer_no_tracking()}</p>
		</div>
	</footer>

	<!-- Mobile (< 46 rem) : les rubriques passent en bas, à portée de pouce. -->
	<nav class="tabbar" aria-label={m.nav_main()}>
		{@render tab(explore, true)}
		{@render tab(questions, true)}
		<a class="write-tab" href={href('/ecrire')} aria-current={current('/ecrire')}>
			<span class="disc"><Icon name="pen" size={22} /></span>
			<span>{m.nav_write()}</span>
		</a>
		{@render tab(toAnswer, true)}
		<a href={href('/identite')} aria-current={current('/identite')}>
			{#if unlocked}
				<Pastille name={unlocked.displayName} print={unlocked.fingerprint} size={24} />
			{:else}
				<Icon name="user" size={22} />
			{/if}
			<span>{m.nav_me()}</span>
		</a>
	</nav>
</div>

<style>
	.shell {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}
	.skip {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 100;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--r-pill);
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
		text-decoration: none;
		transform: translateY(-200%);
	}
	.skip:focus {
		transform: none;
	}
	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.content:focus {
		outline: none;
	}

	/* Même gouttière et même largeur maximale que .page : l'en-tête s'aligne sur le contenu. */
	.inner {
		width: 100%;
		max-width: 80rem;
		margin-inline: auto;
		padding-inline: clamp(1rem, 4vw, 2.5rem);
	}

	/* ── En-tête ─────────────────────────────────────────────── */
	.bar {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding-block: var(--space-1);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		margin-right: var(--space-3);
		padding-right: var(--space-1);
		color: var(--ink);
	}
	.brand :global(.logo) {
		height: 1.5rem;
		width: auto;
	}

	/* Rubriques : zones tactiles d'au moins 44 px de haut (WCAG 2.5.8 vise 24 px au minimum). */
	.sections {
		display: flex;
	}
	.sections a {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 var(--space-3);
		border-radius: var(--radius);
		color: var(--muted);
		font-weight: 500;
		text-decoration: none;
		white-space: nowrap;
	}
	.sections a:hover {
		color: var(--ink);
	}
	.sections a[aria-current] {
		color: var(--ink);
		font-weight: 600;
	}
	.sections a[aria-current]::after {
		content: '';
		position: absolute;
		inset: auto 0.8rem 0.15rem;
		height: 2px;
		border-radius: 2px;
		background: var(--ink);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin-left: auto;
	}

	/* Liens d'action : du texte seul, sans fond ni bordure ; le soulignement signale le survol. */
	.write,
	.me {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 var(--space-2);
		color: var(--ink);
		font-size: var(--text-sm);
		text-decoration: none;
	}
	.write {
		font-weight: 700;
	}
	.me {
		gap: var(--space-2);
		max-width: 13rem;
	}
	.write:hover,
	.me:hover,
	.write[aria-current],
	.me[aria-current] {
		text-decoration: underline;
	}
	.who {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.fp {
		margin-left: 0.1rem;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 400;
	}

	/* Contenu du menu des réglages (le conteneur est dans NavMenu). */
	.group {
		margin: 0;
		padding: var(--space-2) var(--space-3) 0.15rem;
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	hr {
		margin: var(--space-1) 0;
		border: 0;
		border-top: 1px solid var(--line);
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: 2.5rem;
		padding: var(--space-1) var(--space-3) var(--space-1) var(--space-2);
		border: 0;
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: var(--text-sm);
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.item:hover {
		text-decoration: underline;
	}
	.item[aria-current] {
		font-weight: 600;
	}
	.tick {
		display: inline-flex;
		justify-content: center;
		width: 1.4rem;
		flex: none;
		color: var(--muted);
	}

	/* ── Pied de page ────────────────────────────────────────── */
	footer {
		color: var(--muted);
		font-size: var(--text-sm);
	}
	.foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0 var(--space-5);
		padding-block: var(--space-2);
	}
	.foot nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-5);
	}
	.foot a {
		padding-block: var(--space-2);
	}
	.foot p {
		margin: 0;
	}

	/* Barre du bas : masquée sur grand écran. */
	.tabbar {
		display: none;
	}

	/* ── Écrans moyens : l'empreinte du pseudonyme disparaît ─── */
	@media (max-width: 64rem) {
		.fp {
			display: none;
		}
		.me {
			max-width: 11rem;
		}
	}

	/* ── Mobile : barre du bas ───────────────────────────────── */
	@media (max-width: 46rem) {
		.sections,
		.write,
		.me {
			display: none;
		}
		.shell {
			padding-bottom: calc(3.75rem + env(safe-area-inset-bottom));
		}
		.tabbar {
			position: fixed;
			right: 0;
			bottom: 0;
			left: 0;
			z-index: 40;
			display: grid;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			padding-bottom: env(safe-area-inset-bottom);
			border-top: 1px solid var(--line);
			background: var(--paper);
		}
		.tabbar a {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.15rem;
			min-height: 3.75rem;
			padding: var(--space-1) 0.1rem;
			color: var(--muted);
			font-size: var(--text-xs);
			font-weight: 500;
			text-decoration: none;
		}
		.tabbar a[aria-current] {
			color: var(--ink);
			font-weight: 700;
		}
		/* Action principale : pastille pleine qui dépasse de la barre. */
		.disc {
			display: grid;
			place-items: center;
			width: 2.9rem;
			height: 2.9rem;
			margin-top: -1.1rem;
			border-radius: 50%;
			background: var(--accent);
			color: var(--accent-ink);
			box-shadow: 0 0 0 4px var(--paper);
		}
		.write-tab {
			color: var(--ink);
		}
	}
</style>
