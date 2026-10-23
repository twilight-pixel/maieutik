<script lang="ts">
	import TextView from '#lib/components/TextView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<TextView text={data.text} latest={data.latest} />
