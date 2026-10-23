<!--
	Remplacement de la phrase de récupération (clé compromise, docs/03) : nouvelle phrase
	montrée et vérifiée d'abord, puis rotation signée de chaque pseudonyme vers sa nouvelle clé.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { identity } from '#lib/client/identity.svelte.js';

	let step = $state<'idle' | 'words' | 'confirm' | 'running' | 'done'>('idle');
	let mnemonic = $state('');
	let positions = $state<number[]>([]);
	let answers = $state<string[]>([]);
	let progress = $state('');
	let error = $state('');

	function start() {
		// Reprise d'une rotation interrompue : on garde la phrase déjà enregistrée.
		mnemonic = identity.content?.pendingMnemonic ?? identity.generateMnemonic();
		error = '';
		step = 'words';
	}

	function pick() {
		const count = mnemonic.split(' ').length;
		const picked: number[] = [];
		for (const value of crypto.getRandomValues(new Uint32Array(16))) {
			if (!picked.includes(value % count)) picked.push(value % count);
			if (picked.length === 3) break;
		}
		positions = picked.sort((a, b) => a - b);
		answers = positions.map(() => '');
		step = 'confirm';
	}

	async function run(event: SubmitEvent) {
		event.preventDefault();
		const words = mnemonic.split(' ');
		if (!positions.every((p, i) => answers[i].trim().toLowerCase() === words[p])) {
			error = m.id_confirm_error();
			return;
		}
		error = '';
		step = 'running';
		try {
			await identity.replaceMnemonic(mnemonic, (name, ratio) => {
				progress = m.rot_running({ name, percent: Math.round(ratio * 100) });
			});
			step = 'done';
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			step = 'confirm';
		}
	}
</script>

<details>
	<summary>{m.rot_title()}</summary>
	<p class="muted">{m.rot_intro()}</p>

	{#if step === 'idle'}
		<button class="button secondary" onclick={start}>{m.rot_start()}</button>
	{:else if step === 'words'}
		<p class="callout">{m.id_words_warning()}</p>
		<ol class="words">
			{#each mnemonic.split(' ') as word, i (i)}<li>{word}</li>{/each}
		</ol>
		<button class="button" onclick={pick}>{m.id_words_done()}</button>
	{:else if step === 'confirm'}
		<form onsubmit={run}>
			<p>{m.id_confirm_intro()}</p>
			{#each positions as position, i (position)}
				<label>
					{m.id_confirm_word({ n: position + 1 })}
					<input
						bind:value={answers[i]}
						autocomplete="off"
						autocapitalize="none"
						spellcheck="false"
						required
					/>
				</label>
			{/each}
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div><button class="button">{m.id_confirm_submit()}</button></div>
		</form>
	{:else if step === 'running'}
		<p role="status">{progress}</p>
	{:else}
		<p role="status"><strong>{m.rot_done()}</strong></p>
	{/if}
</details>

<style>
	details {
		margin: var(--space-3) 0;
	}
	summary {
		cursor: pointer;
		font-weight: 600;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 32rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-weight: 600;
		font-size: var(--text-sm);
	}
	input {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 400;
	}
	.words {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: var(--space-2) var(--space-5);
		padding: var(--space-4) var(--space-4) var(--space-4) var(--space-6);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		font-family: var(--font-mono);
	}
	.callout {
		padding: var(--space-3) var(--space-4);
		border-left: 3px solid var(--ink);
		background: var(--surface);
	}
	.muted {
		color: var(--muted);
	}
	.error {
		color: var(--danger);
	}
</style>
