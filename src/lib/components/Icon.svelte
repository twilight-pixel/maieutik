<!--
	Pictogrammes de l'interface (tracés au trait, 24 × 24), en SVG inline : aucune image
	ni police d'icônes à charger. Toujours décoratifs : le libellé est porté par le texte voisin.
-->
<script module lang="ts">
	export type IconName =
		'compass' | 'help' | 'reply' | 'pen' | 'user' | 'settings' | 'sun' | 'moon' | 'check';
</script>

<script lang="ts">
	let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	aria-hidden="true"
	focusable="false"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#if name === 'compass'}
		<circle cx="12" cy="12" r="9" />
		<path d="M15.5 8.5l-2 5-5 2 2-5z" />
	{:else if name === 'help'}
		<circle cx="12" cy="12" r="9" />
		<path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7" />
		<path d="M12 17h.01" />
	{:else if name === 'reply'}
		<path d="M9 14L4 9l5-5" />
		<path d="M4 9h10a6 6 0 0 1 6 6v3" />
	{:else if name === 'pen'}
		<path d="M12 20h9" />
		<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
	{:else if name === 'user'}
		<circle cx="12" cy="8" r="4" />
		<path d="M4 21a8 8 0 0 1 16 0" />
	{:else if name === 'settings'}
		<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h7M15 18h5" />
		<circle cx="15" cy="6" r="2" />
		<circle cx="9" cy="12" r="2" />
		<circle cx="13" cy="18" r="2" />
	{:else if name === 'sun'}
		<circle cx="12" cy="12" r="4" />
		<path
			d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
		/>
	{:else if name === 'moon'}
		<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
	{:else if name === 'check'}
		<path d="M5 12.5l4.5 4.5L19 7.5" />
	{/if}
</svg>
