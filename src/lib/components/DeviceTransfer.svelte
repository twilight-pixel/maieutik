<!--
	Transfert d'identité entre appareils (docs/03, phase 3) : le coffre est chiffré par un code
	à usage unique et affiché en QR code ; l'autre appareil le lit (caméra) ou le colle, puis
	saisit le code. Rien ne transite par le serveur.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { identity } from '#lib/client/identity.svelte.js';
	import { newTransferCode } from '#lib/shared/vault.js';
	import QrCode from './QrCode.svelte';

	let { mode }: { mode: 'send' | 'receive' } = $props();

	let text = $state('');
	let code = $state('');
	let error = $state('');
	let busy = $state(false);
	let scanning = $state(false);
	let video = $state<HTMLVideoElement>();
	let stream: MediaStream | null = null;

	type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
	const BarcodeDetectorClass = (globalThis as { BarcodeDetector?: new (o: object) => Detector })
		.BarcodeDetector;

	async function show() {
		busy = true;
		code = newTransferCode();
		text = await identity.transferText(code);
		busy = false;
	}

	function hide() {
		text = '';
		code = '';
	}

	async function scan() {
		if (!BarcodeDetectorClass) {
			error = m.qr_scan_unavailable();
			return;
		}
		error = '';
		scanning = true;
		const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
		stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
		if (!video) return;
		video.srcObject = stream;
		await video.play();
		while (scanning) {
			const [found] = await detector.detect(video).catch(() => []);
			if (found?.rawValue) {
				text = found.rawValue;
				stop();
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
	}

	function stop() {
		scanning = false;
		stream?.getTracks().forEach((track) => track.stop());
		stream = null;
	}

	async function receive(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		try {
			await identity.importTransfer(text, code);
		} catch {
			error = m.qr_invalid();
		} finally {
			busy = false;
		}
	}

	onDestroy(stop);
</script>

{#if mode === 'send'}
	<details>
		<summary>{m.qr_title()}</summary>
		<p class="muted">{m.qr_intro()}</p>
		{#if text}
			<QrCode value={text} label={m.qr_title()} />
			<p>{m.qr_code()} : <strong class="code">{code}</strong></p>
			<details>
				<summary>{m.qr_text()}</summary>
				<textarea readonly rows="4">{text}</textarea>
			</details>
			<button class="button secondary" onclick={hide}>{m.qr_hide()}</button>
		{:else}
			<button class="button secondary" onclick={show} disabled={busy}>{m.qr_show()}</button>
		{/if}
	</details>
{:else}
	<form onsubmit={receive}>
		<p class="muted">{m.qr_intro()}</p>
		<button type="button" class="button secondary" onclick={scan} disabled={scanning}
			>{m.qr_scan()}</button
		>
		<video bind:this={video} class:hidden={!scanning} playsinline></video>
		<label>
			{m.qr_paste()}
			<textarea bind:value={text} rows="3" required autocomplete="off" spellcheck="false"
			></textarea>
		</label>
		<label>
			{m.qr_code_input()}
			<input bind:value={code} required autocomplete="off" autocapitalize="characters" />
		</label>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div><button class="button" disabled={busy}>{m.qr_import()}</button></div>
	</form>
{/if}

{#if mode === 'send' && error}<p class="error" role="alert">{error}</p>{/if}

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
	textarea,
	input {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 400;
	}
	textarea {
		width: 100%;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	.code {
		font-family: var(--font-mono);
		font-size: var(--text-lg);
		letter-spacing: 0.1em;
	}
	video {
		width: min(100%, 22rem);
		border-radius: var(--radius);
	}
	.hidden {
		display: none;
	}
	.muted {
		color: var(--muted);
	}
	.error {
		color: var(--danger);
	}
</style>
