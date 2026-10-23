<!--
	Pagination par liens (fonctionne sans JavaScript). Conserve les autres paramètres de
	l'URL (recherche, tri, filtre) et ne change que `page`.
-->
<script lang="ts">
	import { page as current } from '$app/state';
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import { deLocalizeHref } from '#lib/paraglide/runtime.js';

	let {
		page,
		hasNext,
		param = 'page',
		anchor = ''
	}: { page: number; hasNext: boolean; param?: string; anchor?: string } = $props();

	function link(target: number): string {
		const entries = [...current.url.searchParams].filter(([key]) => key !== param);
		if (target > 1) entries.push([param, String(target)]);
		const query = entries
			.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
			.join('&');
		// Chemin sans le préfixe de langue : href() le remet selon la langue courante.
		const path = deLocalizeHref(current.url.pathname);
		return href(path + (query ? `?${query}` : '')) + (anchor ? `#${anchor}` : '');
	}
</script>

{#if page > 1 || hasNext}
	<nav class="pager" aria-label={m.list_pages()}>
		{#if page > 1}
			<a href={link(page - 1)} rel="prev">← {m.list_previous()}</a>
		{:else}<span></span>{/if}
		<span class="current">{m.list_page({ page })}</span>
		{#if hasNext}
			<a href={link(page + 1)} rel="next">{m.list_next()} →</a>
		{:else}<span></span>{/if}
	</nav>
{/if}

<style>
	.pager {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-4);
		margin-top: var(--space-5);
		font-size: var(--text-sm);
	}
	.current {
		color: var(--muted);
	}
</style>
