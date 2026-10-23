<!-- QR code rendu en SVG à partir de la matrice d'uqr (aucun HTML injecté, aucune ressource externe). -->
<script lang="ts">
	import { encode } from 'uqr';

	let { value, label }: { value: string; label: string } = $props();

	const qr = $derived(encode(value, { ecc: 'L', border: 2 }));
	// Un seul tracé : un carré d'une unité par module noir.
	const path = $derived(
		qr.data.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : ''))).join('')
	);
</script>

<svg
	class="qr"
	viewBox="0 0 {qr.size} {qr.size}"
	role="img"
	aria-label={label}
	shape-rendering="crispEdges"
	xmlns="http://www.w3.org/2000/svg"
>
	<rect width={qr.size} height={qr.size} fill="#ffffff" />
	<path d={path} fill="#000000" />
</svg>

<style>
	.qr {
		display: block;
		width: min(100%, 22rem);
		height: auto;
		border-radius: var(--radius);
	}
</style>
