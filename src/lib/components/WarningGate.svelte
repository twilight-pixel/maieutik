<!--
	Contenu sous avertissement (docs/06). Sans JavaScript : replié dans un <details>.
	Avec JavaScript : selon les préférences du lecteur (afficher, replier, masquer).
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { warningLabel } from '#lib/i18n.js';
	import { loadPrefs, modeFor, type WarningMode } from '#lib/client/reading-prefs.js';
	import type { ContentWarning } from '#lib/shared/content.js';

	let { warnings, children }: { warnings: ContentWarning[]; children: Snippet } = $props();

	let mode = $state<WarningMode>('blur');
	let revealed = $state(false);
	const labels = $derived(warnings.map(warningLabel).join(', '));

	onMount(() => {
		mode = modeFor(warnings, loadPrefs());
	});
</script>

{#if mode === 'show' || revealed}
	<p class="label"><strong>{m.warning_heading()} :</strong> {labels}.</p>
	{@render children()}
{:else if mode === 'hide'}
	<p class="hidden">
		{m.prefs_hidden_notice({ warnings: labels })}
		<button class="link" onclick={() => (revealed = true)}>{m.prefs_hidden_show()}</button>
	</p>
{:else}
	<details class="warning">
		<summary>
			<strong>{m.warning_heading()} :</strong>
			{labels}. <span class="show">{m.warning_show()}</span>
		</summary>
		{@render children()}
	</details>
{/if}

<style>
	.warning,
	.hidden {
		margin-top: var(--space-6);
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.warning summary {
		cursor: pointer;
	}
	.warning .show {
		text-decoration: underline;
	}
	.label {
		margin: var(--space-6) 0 0;
		font-size: var(--text-sm);
		color: var(--muted);
	}
	.hidden {
		color: var(--muted);
	}
	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
