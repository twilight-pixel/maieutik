<!--
	Indicateur discret des votes de juré en attente (D18). Rien sans JavaScript, rien pour
	un pseudonyme qui ne s'est pas porté volontaire sur cet appareil.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { href } from '#lib/href.js';
	import { m } from '#lib/paraglide/messages.js';
	import { identity } from '#lib/client/identity.svelte.js';
	import { cachedPending, isVolunteer, storePending } from '#lib/client/jury-reminder.js';

	let count = $state(0);

	onMount(async () => {
		await identity.init();
		const key = identity.active?.publicKey;
		if (!key || !isVolunteer(key)) return;
		const cached = cachedPending(key);
		if (cached !== null) {
			count = cached;
			return;
		}
		try {
			const result = (await identity.submit('/api/jury/assignments', 'jury-access', {
				requestedAt: Date.now()
			})) as { assignments: unknown[] };
			count = result.assignments.length;
			storePending(key, count);
		} catch {
			// Pas de rappel si la vérification échoue : la page /jury reste accessible.
		}
	});
</script>

{#if count > 0}
	<a class="badge" href={href('/jury')} title={m.jury_badge({ count })}
		><span aria-hidden="true">⚖</span> <span class="count">{count}</span><span
			class="visually-hidden">{m.jury_badge({ count })}</span
		></a
	>
{/if}

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 2rem;
		padding: 0.1rem var(--space-3);
		border-radius: var(--r-pill);
		background: var(--ink);
		color: var(--paper);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
	}
</style>
