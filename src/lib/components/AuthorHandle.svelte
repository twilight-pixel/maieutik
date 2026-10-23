<script lang="ts">
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';

	let {
		author
	}: { author: { key: string; displayName: string; fingerprint: string; isTeam: boolean } } =
		$props();
</script>

<a class="handle" href={href(`/pseudonymes/${author.key}`)}
	>{author.displayName}<span class="fp">#{author.fingerprint}</span></a
>{#if author.isTeam}<span class="team">{m.text_team()}</span>{/if}

<style>
	.handle {
		font-weight: 600;
		text-decoration: none;
	}
	.handle:hover {
		text-decoration: underline;
	}
	.fp {
		font-weight: 400;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.9em;
	}
	.team {
		margin-left: var(--space-2);
		padding: 0 var(--space-2);
		border: 1px solid var(--line);
		border-radius: var(--r-pill);
		font-size: var(--text-xs);
		color: var(--muted);
	}
</style>
