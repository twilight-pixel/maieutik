<!--
	Pastille d'un pseudonyme : initiale sur une teinte tirée de l'empreinte (docs/11).
	Déterministe et locale : ni image, ni photo, ni compteur.
-->
<script lang="ts">
	let { name, print, size = 28 }: { name: string; print: string; size?: number } = $props();

	const hue = $derived((Number.parseInt(print.slice(0, 4), 16) || 0) % 360);
	const initial = $derived([...name.trim()][0]?.toUpperCase() ?? '?');
</script>

<svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
	<circle cx="16" cy="16" r="16" fill={`hsl(${hue} 38% 34%)`} />
	<text x="16" y="16.5" text-anchor="middle" dominant-baseline="central" fill="#fff">{initial}</text
	>
</svg>

<style>
	text {
		font: 600 15px var(--font-reading);
	}
</style>
