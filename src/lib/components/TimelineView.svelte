<!--
	Frise chronologique (D17) : liste ordonnée d'événements, lisible sans JavaScript.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { TimelineEvent } from '#lib/shared/blocks.js';

	let { events }: { events: readonly TimelineEvent[] } = $props();
</script>

<ol class="timeline" aria-label={m.blk_timeline()}>
	{#each events as event, i (i)}
		<li>
			<span class="date">{event.date}</span>
			<span class="title">{event.title}</span>
			{#if event.text}<span class="text">{event.text}</span>{/if}
		</li>
	{/each}
</ol>

<style>
	.timeline {
		position: relative;
		margin: var(--space-5) 0;
		padding: 0 0 0 var(--space-5);
		list-style: none;
		border-left: 2px solid var(--line);
	}
	li {
		position: relative;
		display: grid;
		gap: 0.1rem;
		padding-bottom: var(--space-4);
	}
	li::before {
		content: '';
		position: absolute;
		left: calc(-1.5rem - 6px);
		top: 0.55em;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--ink);
	}
	.date {
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--muted);
	}
	.title {
		font-weight: 650;
	}
</style>
