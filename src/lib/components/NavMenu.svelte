<!--
	Menu déroulant de l'en-tête. Un <details> : il s'ouvre et se ferme sans JavaScript.
	Avec JavaScript, il se referme aussi au clic ailleurs, à Échap et après une navigation.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { afterNavigate } from '$app/navigation';

	let { label, trigger, children }: { label: string; trigger: Snippet; children: Snippet } =
		$props();

	let menu: HTMLDetailsElement | undefined = $state();

	const close = () => {
		if (menu) menu.open = false;
	};

	afterNavigate(close);

	function onWindowClick(event: MouseEvent) {
		if (menu?.open && !menu.contains(event.target as Node)) close();
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !menu?.open) return;
		close();
		menu.querySelector('summary')?.focus();
	}

	function onFocusOut(event: FocusEvent) {
		const next = event.relatedTarget as Node | null;
		if (menu?.open && next && !menu.contains(next)) close();
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<details bind:this={menu} onfocusout={onFocusOut}>
	<summary aria-label={label} title={label}>{@render trigger()}</summary>
	<div class="panel">{@render children()}</div>
</details>

<style>
	details {
		position: relative;
	}
	summary {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: var(--r-pill);
		color: var(--ink);
		list-style: none;
		cursor: pointer;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover {
		opacity: 0.7;
	}
	.panel {
		position: absolute;
		top: calc(100% + 0.25rem);
		right: 0;
		z-index: 60;
		min-width: 15rem;
		max-width: calc(100vw - 2rem);
		padding: var(--space-2);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: 0 12px 32px rgb(0 0 0 / 0.14);
	}
</style>
