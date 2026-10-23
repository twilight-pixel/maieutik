<!-- Cas de test des règles génériques de .semgrep/maieutik.yml -->
<script lang="ts">
	let { text } = $props();
</script>

<!-- ruleid: maieutik-no-raw-html-svelte -->
<div>{@html text}</div>
<!-- ok: maieutik-no-raw-html-svelte -->
<div>{text}</div>

<!-- ruleid: maieutik-no-external-resource-markup -->
<img src="https://images.example.com/a.png" alt="" />
<!-- ruleid: maieutik-no-external-resource-markup -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />
<!-- ok: maieutik-no-external-resource-markup -->
<img src="/media/a.png" alt="" />
<!-- ok: maieutik-no-external-resource-markup -->
<a href="https://fr.wikipedia.org/" rel="noreferrer noopener">source</a>

<style>
	@font-face {
		font-family: X;
		/* ruleid: maieutik-no-external-resource-markup */
		src: url('https://fonts.gstatic.com/x.woff2');
	}
	@font-face {
		font-family: Y;
		/* ok: maieutik-no-external-resource-markup */
		src: url('/fonts/y.woff2');
	}
</style>
