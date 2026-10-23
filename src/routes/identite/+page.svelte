<!--
	Gestion de l'identité (docs/03, D06) : création guidée avec sauvegarde vérifiée,
	import d'une phrase ou d'un fichier de clé, pseudonymes multiples, phrase secrète locale.
-->
<script lang="ts">
	import { href } from '#lib/href.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { identity } from '#lib/client/identity.svelte.js';
	import DeviceTransfer from '#lib/components/DeviceTransfer.svelte';
	import KeyRotation from '#lib/components/KeyRotation.svelte';
	import {
		MIN_PASSPHRASE_LENGTH,
		parseSealedVault,
		WrongPassphraseError
	} from '#lib/shared/vault.js';
	import { isValidMnemonic } from '#lib/shared/identity.js';
	import { validatePseudonym } from '#lib/shared/payloads.js';

	// Page d'où l'on vient (ex. un texte en cours d'écriture) : on y revient une fois le pseudonyme prêt.
	// Chemin interne seulement (une seule barre oblique initiale), jamais une adresse complète.
	const retour = $derived.by(() => {
		const value = page.url.searchParams.get('retour');
		// Une seule barre oblique initiale (pas de //hôte), ni barre inverse ni saut de ligne.
		return value && /^\/(?![/\\])/.test(value) && !/[\r\n]/.test(value) ? value : null;
	});

	type View = 'start' | 'words' | 'confirm' | 'import' | 'file' | 'name';

	// Dès qu'un pseudonyme devient actif (création, import, déverrouillage), retour à la page d'origine.
	let hadPseudonym: boolean | undefined;
	$effect(() => {
		if (identity.status === 'loading') return;
		const has = identity.active !== null;
		const before = hadPseudonym;
		hadPseudonym = has;
		if (before === false && has && retour) void goto(href(retour));
	});

	let view = $state<View>('start');
	let error = $state('');
	let busy = $state(false);
	let notice = $state('');

	// Création : phrase affichée puis vérifiée sur trois positions tirées au hasard.
	let mnemonic = $state('');
	let positions = $state<number[]>([]);
	let answers = $state<string[]>([]);
	let backupOnly = $state(false);

	let importText = $state('');
	let fileVault = $state<ReturnType<typeof parseSealedVault>>(null);
	let passphrase = $state('');
	let passphrase2 = $state('');
	let displayName = $state('');
	let invitation = $state('');
	// Inscription sur invitation pendant le démarrage (docs/07), selon la configuration du serveur.
	let invitationRequired = $state(false);
	let powPercent = $state<number | null>(null);
	let showProtect = $state(false);
	let showExport = $state(false);

	onMount(() => {
		identity.init();
		fetch('/api/pseudonyms')
			.then((response) => response.json())
			.then(
				(config: { invitationRequired: boolean }) =>
					(invitationRequired = config.invitationRequired)
			)
			.catch(() => {});
	});

	function reset(next: View) {
		error = '';
		notice = '';
		passphrase = '';
		passphrase2 = '';
		view = next;
	}

	function startCreate() {
		mnemonic = identity.generateMnemonic();
		backupOnly = false;
		reset('words');
	}

	function startBackup() {
		mnemonic = identity.content?.mnemonic ?? '';
		backupOnly = true;
		reset('words');
	}

	function pickPositions() {
		const count = mnemonic.split(' ').length;
		const picked: number[] = [];
		const random = new Uint32Array(16);
		crypto.getRandomValues(random);
		for (const value of random) {
			if (!picked.includes(value % count)) picked.push(value % count);
			if (picked.length === 3) break;
		}
		positions = picked.sort((a, b) => a - b);
		answers = positions.map(() => '');
		reset('confirm');
	}

	async function confirmWords(event: SubmitEvent) {
		event.preventDefault();
		const words = mnemonic.split(' ');
		const ok = positions.every((p, i) => answers[i].trim().toLowerCase() === words[p]);
		if (!ok) {
			error = m.id_confirm_error();
			return;
		}
		if (backupOnly) {
			await identity.confirmBackup();
			reset('start');
			notice = m.id_saved();
			return;
		}
		await identity.adopt(mnemonic, { backedUp: true });
		mnemonic = '';
		reset('name');
	}

	async function importPhrase(event: SubmitEvent) {
		event.preventDefault();
		if (!isValidMnemonic(importText)) {
			error = m.id_import_invalid();
			return;
		}
		busy = true;
		try {
			await identity.adopt(importText, { backedUp: true });
			importText = '';
			reset(identity.pseudonyms.length === 0 ? 'name' : 'start');
		} finally {
			busy = false;
		}
	}

	async function readFile(event: Event) {
		error = '';
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			fileVault = parseSealedVault(JSON.parse(await file.text()));
		} catch {
			fileVault = null;
		}
		if (!fileVault || fileVault.kdf !== 'argon2id') error = m.id_file_invalid();
	}

	async function importKeyFile(event: SubmitEvent) {
		event.preventDefault();
		if (!fileVault) return;
		busy = true;
		error = '';
		try {
			await identity.importFile(fileVault, passphrase);
			reset('start');
		} catch (e) {
			error = e instanceof WrongPassphraseError ? m.id_passphrase_wrong() : m.id_file_invalid();
		} finally {
			busy = false;
		}
	}

	async function unlock(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		try {
			await identity.unlock(passphrase);
			reset('start');
		} catch (e) {
			error = e instanceof WrongPassphraseError ? m.id_passphrase_wrong() : String(e);
		} finally {
			busy = false;
		}
	}

	async function createPseudonym(event: SubmitEvent) {
		event.preventDefault();
		const name = displayName.trim();
		const check = validatePseudonym({ displayName: name });
		if (!check.ok) {
			error = check.error;
			return;
		}
		busy = true;
		error = '';
		powPercent = 0;
		try {
			await identity.createPseudonym(
				name,
				(ratio) => (powPercent = Math.round(ratio * 100)),
				invitationRequired ? invitation.trim() : undefined
			);
			displayName = '';
			reset('start');
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
			powPercent = null;
		}
	}

	function passphraseError(): string | null {
		if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
			return m.id_passphrase_short({ n: MIN_PASSPHRASE_LENGTH });
		}
		if (passphrase !== passphrase2) return m.id_passphrase_mismatch();
		return null;
	}

	async function protect(event: SubmitEvent) {
		event.preventDefault();
		const problem = passphraseError();
		if (problem) {
			error = problem;
			return;
		}
		busy = true;
		await identity.setPassphrase(passphrase);
		busy = false;
		showProtect = false;
		reset('start');
		notice = m.id_saved();
	}

	async function exportKey(event: SubmitEvent) {
		event.preventDefault();
		const problem = passphraseError();
		if (problem) {
			error = problem;
			return;
		}
		busy = true;
		const blob = await identity.exportFile(passphrase);
		busy = false;
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'maieutik-cle.json';
		link.click();
		URL.revokeObjectURL(url);
		showExport = false;
		reset('start');
	}

	async function forget() {
		if (!confirm(m.id_forget_confirm())) return;
		await identity.forget();
		reset('start');
	}
</script>

<svelte:head>
	<title>{m.id_title()} · Maieutik</title>
</svelte:head>

<main class="page">
	<h1>{m.id_title()}</h1>
	<p class="intro">{m.id_intro()}</p>

	<noscript><p class="callout">{m.id_js_required()}</p></noscript>

	{#if identity.ephemeral}
		<p class="callout">{m.id_ephemeral()}</p>
	{/if}

	{#if notice}<p class="notice" role="status">{notice}</p>{/if}

	{#if identity.status === 'loading'}
		<p class="muted">{m.id_loading()}</p>
	{:else if view === 'words'}
		<section>
			<h2>{m.id_words_title()}</h2>
			<p class="callout">{m.id_words_warning()}</p>
			<ol class="words" data-testid="mnemonic">
				{#each mnemonic.split(' ') as word, i (i)}<li>{word}</li>{/each}
			</ol>
			<div class="row">
				<button class="button secondary" onclick={() => reset('start')}>{m.id_back()}</button>
				<button class="button" onclick={pickPositions}>{m.id_words_done()}</button>
			</div>
		</section>
	{:else if view === 'confirm'}
		<form onsubmit={confirmWords}>
			<h2>{m.id_confirm_title()}</h2>
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
			<div class="row">
				<button type="button" class="button secondary" onclick={() => reset('words')}
					>{m.id_back()}</button
				>
				<button class="button">{m.id_confirm_submit()}</button>
			</div>
		</form>
	{:else if view === 'import'}
		<form onsubmit={importPhrase}>
			<label>
				{m.id_import_label()}
				<textarea
					bind:value={importText}
					rows="3"
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					required></textarea>
			</label>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div class="row">
				<button type="button" class="button secondary" onclick={() => reset('start')}
					>{m.id_back()}</button
				>
				<button class="button" disabled={busy}>{m.id_import_submit()}</button>
			</div>
		</form>
	{:else if view === 'file'}
		<form onsubmit={importKeyFile}>
			<label>
				{m.id_file_label()}
				<input type="file" accept="application/json,.json" onchange={readFile} required />
			</label>
			<label>
				{m.id_passphrase()}
				<input type="password" bind:value={passphrase} autocomplete="current-password" required />
			</label>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div class="row">
				<button type="button" class="button secondary" onclick={() => reset('start')}
					>{m.id_back()}</button
				>
				<button class="button" disabled={busy || !fileVault}>{m.id_import_submit()}</button>
			</div>
		</form>
	{:else if view === 'name' || (identity.status === 'unlocked' && identity.pseudonyms.length === 0)}
		<form onsubmit={createPseudonym}>
			<h2>{m.id_name_title()}</h2>
			<p class="muted">{m.id_name_hint()}</p>
			<label>
				{m.id_name_label()}
				<input bind:value={displayName} maxlength="40" autocomplete="off" required />
			</label>
			{#if invitationRequired}
				<label>
					{m.id_invitation()}
					<input bind:value={invitation} autocomplete="off" autocapitalize="characters" required />
					<span class="muted">{m.id_invitation_hint()}</span>
				</label>
			{/if}
			{#if powPercent !== null}<p class="muted" role="status">
					{m.id_pow_running({ percent: powPercent })}
				</p>{/if}
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<button class="button" disabled={busy}>{m.id_name_submit()}</button>
		</form>
	{:else if identity.status === 'none'}
		<div class="choices">
			<button class="button" onclick={startCreate}>{m.id_start_create()}</button>
			<button class="button secondary" onclick={() => reset('import')}>{m.id_start_import()}</button
			>
			<button class="button secondary" onclick={() => reset('file')}>{m.id_start_file()}</button>
		</div>
		<details class="receive">
			<summary>{m.qr_receive()}</summary>
			<DeviceTransfer mode="receive" />
		</details>
	{:else if identity.status === 'locked'}
		<form onsubmit={unlock}>
			<h2>{m.id_unlock_title()}</h2>
			<label>
				{m.id_passphrase()}
				<input type="password" bind:value={passphrase} autocomplete="current-password" required />
			</label>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
			<div class="row">
				<button class="button" disabled={busy}>{m.id_unlock_submit()}</button>
				<button type="button" class="button secondary" onclick={forget}>{m.id_forget()}</button>
			</div>
		</form>
	{:else}
		{#if identity.content && !identity.content.backedUp}
			<div class="callout">
				<p>{m.id_backup_reminder()}</p>
				<button class="button" onclick={startBackup}>{m.id_backup_now()}</button>
			</div>
		{/if}

		<section>
			<h2>{m.id_pseudonyms()}</h2>
			<ul class="pseudonyms">
				{#each identity.pseudonyms as p (p.index)}
					<li>
						<span class="handle">{p.displayName}<span class="fp">#{p.fingerprint}</span></span>
						{#if p.index === identity.active?.index}
							<span class="active">{m.id_active()}</span>
						{:else}
							<button class="link" onclick={() => identity.selectPseudonym(p.index)}
								>{m.id_use()}</button
							>
						{/if}
						<a href={href(`/pseudonymes/${p.publicKey}`)}>{m.id_view_works()}</a>
					</li>
				{/each}
			</ul>
			<div class="row">
				<a class="button" href={href(retour ?? '/ecrire')}
					>{retour ? m.id_back_to_text() : m.id_write()}</a
				>
				<a class="button secondary" href={href('/jury')}>{m.jury_mine_title()}</a>
				<button class="button secondary" onclick={() => reset('name')} title={m.id_add_hint()}
					>{m.id_add_pseudonym()}</button
				>
			</div>
		</section>

		<section>
			<h2>{m.id_security()}</h2>
			{#if identity.protectedByPassphrase}
				<p>{m.id_protected()}</p>
				<div class="row">
					<button class="button secondary" onclick={() => identity.lock()}>{m.id_lock()}</button>
					<button class="button secondary" onclick={() => identity.setPassphrase(null)}
						>{m.id_remove_protection()}</button
					>
				</div>
			{:else if !identity.ephemeral}
				<details bind:open={showProtect}>
					<summary>{m.id_protect()}</summary>
					<form onsubmit={protect}>
						<p class="muted">{m.id_protect_hint()}</p>
						<label
							>{m.id_passphrase()}<input
								type="password"
								bind:value={passphrase}
								autocomplete="new-password"
								required
							/></label
						>
						<label
							>{m.id_passphrase_confirm()}<input
								type="password"
								bind:value={passphrase2}
								autocomplete="new-password"
								required
							/></label
						>
						{#if error && showProtect}<p class="error" role="alert">{error}</p>{/if}
						<button class="button" disabled={busy}>{m.id_protect()}</button>
					</form>
				</details>
			{/if}
			<details bind:open={showExport}>
				<summary>{m.id_export()}</summary>
				<form onsubmit={exportKey}>
					<p class="muted">{m.id_export_hint()}</p>
					<label
						>{m.id_passphrase()}<input
							type="password"
							bind:value={passphrase}
							autocomplete="new-password"
							required
						/></label
					>
					<label
						>{m.id_passphrase_confirm()}<input
							type="password"
							bind:value={passphrase2}
							autocomplete="new-password"
							required
						/></label
					>
					{#if error && showExport}<p class="error" role="alert">{error}</p>{/if}
					<button class="button" disabled={busy}>{m.id_export_submit()}</button>
				</form>
			</details>
			<DeviceTransfer mode="send" />
			<KeyRotation />
			<p><button class="link danger" onclick={forget}>{m.id_forget()}</button></p>
		</section>
	{/if}
</main>

<style>
	.intro {
		color: var(--muted);
	}
	section,
	form,
	.choices {
		margin-top: var(--space-5);
	}
	form,
	.choices {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 32rem;
	}
	.choices {
		align-items: flex-start;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-weight: 600;
		font-size: var(--text-sm);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.words {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: var(--space-2) var(--space-5);
		padding: var(--space-5) var(--space-5) var(--space-5) var(--space-6);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		font-family: var(--font-mono);
		font-size: var(--text-read);
	}
	.callout {
		padding: var(--space-4) var(--space-5);
		border-left: 3px solid var(--ink);
		background: var(--surface);
	}
	.callout p {
		margin-top: 0;
	}
	.notice {
		font-weight: 600;
	}
	.error {
		color: var(--danger);
		margin: 0;
	}
	.muted {
		color: var(--muted);
	}
	.pseudonyms {
		list-style: none;
		padding: 0;
	}
	.pseudonyms li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--line);
	}
	.handle {
		font-weight: 600;
	}
	.fp {
		font-weight: 400;
		color: var(--muted);
		font-family: var(--font-mono);
	}
	.active {
		font-size: var(--text-sm);
		padding: 0 var(--space-2);
		border-radius: var(--r-pill);
		background: var(--ink);
		color: var(--paper);
	}
	.link {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
	.danger {
		color: var(--danger);
	}
	details {
		margin: var(--space-3) 0;
	}
	summary {
		cursor: pointer;
		font-weight: 600;
	}
</style>
