/**
 * Identité de l'utilisateur dans le navigateur (D01, D06) : phrase de récupération,
 * pseudonymes dérivés, coffre chiffré, signature des contenus.
 *
 * La phrase et les clés privées ne quittent jamais le navigateur. Le serveur ne reçoit
 * que des contenus signés et des clés publiques.
 */
import { browser } from '$app/env';
import { keystore } from './keystore';
import {
	createMnemonic,
	derivePseudonymKeypair,
	fingerprint,
	isValidMnemonic,
	mnemonicToSeed,
	normalizeMnemonic,
	type Keypair
} from '#lib/shared/identity.js';
import { encodeKey, sign, type SignedEnvelope, type SignedKind } from '#lib/shared/signature.js';
import { solveChallenge, type PowChallenge } from '#lib/shared/pow.js';
import type { JsonValue } from '#lib/shared/canonical-json.js';
import {
	createDeviceKey,
	decodeTransfer,
	encodeTransfer,
	normalizeTransferCode,
	openVault,
	TRANSFER_ARGON2,
	sealWithDeviceKey,
	sealWithPassphrase,
	type SealedVault,
	type VaultContent
} from '#lib/shared/vault.js';

export type IdentityStatus = 'loading' | 'none' | 'locked' | 'unlocked';

export type PseudonymView = {
	index: number;
	displayName: string;
	registered: boolean;
	publicKey: string;
	fingerprint: string;
};

const VAULT_KEY = 'vault';
const DEVICE_KEY = 'device-key';
const ACTIVE_KEY = 'active-index';

export class ApiRequestError extends Error {}

async function postJson(path: string, data: unknown): Promise<unknown> {
	const response = await fetch(path, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(data)
	});
	const body = (await response.json().catch(() => ({}))) as { error?: string };
	if (!response.ok) throw new ApiRequestError(body.error ?? `Erreur ${response.status}`);
	return body;
}

class Identity {
	status = $state<IdentityStatus>('loading');
	/** Le stockage persistant est indisponible (Tor Browser, navigation privée). */
	ephemeral = $state(false);
	protectedByPassphrase = $state(false);
	content = $state<VaultContent | null>(null);
	activeIndex = $state(0);

	#seed: Uint8Array | null = null;
	#passphrase: string | null = null;
	#keys = new Map<number, Keypair>();

	pseudonyms = $derived<PseudonymView[]>(
		(this.content?.pseudonyms ?? []).map((p) => {
			const { publicKey } = this.#keypair(p.index);
			return {
				...p,
				publicKey: encodeKey(publicKey),
				fingerprint: fingerprint(publicKey)
			};
		})
	);

	active = $derived<PseudonymView | null>(
		this.pseudonyms.find((p) => p.index === this.activeIndex) ?? this.pseudonyms[0] ?? null
	);

	#initialization: Promise<void> | null = null;

	/** Idempotent : plusieurs composants peuvent l'appeler, le coffre n'est lu qu'une fois. */
	init(): Promise<void> {
		if (!browser || this.status !== 'loading') return Promise.resolve();
		this.#initialization ??= this.#restore();
		return this.#initialization;
	}

	async #restore(): Promise<void> {
		this.ephemeral = !(await keystore.available());
		if (this.ephemeral) {
			this.status = 'none';
			return;
		}
		const vault = await keystore.get<SealedVault>(VAULT_KEY);
		this.activeIndex = (await keystore.get<number>(ACTIVE_KEY)) ?? 0;
		if (!vault) {
			this.status = 'none';
		} else if (vault.kdf === 'argon2id') {
			this.protectedByPassphrase = true;
			this.status = 'locked';
		} else {
			const key = await keystore.get<CryptoKey>(DEVICE_KEY);
			if (!key) {
				this.status = 'none';
				return;
			}
			this.#load(await openVault(vault, key));
		}
	}

	#load(content: VaultContent) {
		this.#seed = mnemonicToSeed(content.mnemonic);
		this.#keys.clear();
		this.content = content;
		this.status = 'unlocked';
	}

	#keypair(index: number): Keypair {
		if (!this.#seed) throw new Error('Identité verrouillée');
		let keys = this.#keys.get(index);
		if (!keys) {
			keys = derivePseudonymKeypair(this.#seed, index);
			this.#keys.set(index, keys);
		}
		return keys;
	}

	async #persist() {
		if (!this.content || this.ephemeral) return;
		const content = $state.snapshot(this.content);
		if (this.#passphrase) {
			await keystore.set(VAULT_KEY, await sealWithPassphrase(this.#passphrase, content));
			await keystore.delete(DEVICE_KEY);
		} else {
			let key = await keystore.get<CryptoKey>(DEVICE_KEY);
			if (!key) {
				key = await createDeviceKey();
				await keystore.set(DEVICE_KEY, key);
			}
			await keystore.set(VAULT_KEY, await sealWithDeviceKey(key, content));
		}
		await keystore.persist();
	}

	/** Nouvelle phrase de récupération (12 mots). Rien n'est enregistré avant `adopt`. */
	generateMnemonic(): string {
		return createMnemonic();
	}

	/** Adopte une phrase (nouvelle ou importée) comme identité de cet appareil. */
	async adopt(mnemonic: string, { backedUp }: { backedUp: boolean }): Promise<void> {
		if (!isValidMnemonic(mnemonic)) throw new Error('Phrase de récupération invalide');
		const normalized = normalizeMnemonic(mnemonic);
		this.#load({ mnemonic: normalized, pseudonyms: [], backedUp });
		if (backedUp) await this.#discoverPseudonyms();
		await this.#persist();
	}

	/** Retrouve les pseudonymes déjà créés avec cette phrase (index 0 à 9). */
	async #discoverPseudonyms() {
		const found: VaultContent['pseudonyms'] = [];
		for (let index = 0; index < 10; index++) {
			const key = encodeKey(this.#keypair(index).publicKey);
			const response = await fetch(`/api/pseudonyms/${key}`);
			if (response.ok) {
				const { displayName } = (await response.json()) as { displayName: string };
				found.push({ index, displayName, registered: true });
			}
		}
		if (this.content) this.content.pseudonyms = found;
	}

	async unlock(passphrase: string): Promise<void> {
		const vault = await keystore.get<SealedVault>(VAULT_KEY);
		if (!vault) throw new Error('Aucune identité sur cet appareil');
		const content = await openVault(vault, passphrase);
		this.#passphrase = passphrase;
		this.#load(content);
	}

	/** Oublie les clés en mémoire. Sans phrase secrète, revient à l'état « aucune identité ». */
	lock(): void {
		this.#seed = null;
		this.#passphrase = null;
		this.#keys.clear();
		this.content = null;
		this.status = this.protectedByPassphrase && !this.ephemeral ? 'locked' : 'none';
	}

	/** Efface l'identité de cet appareil. Sans sauvegarde, elle est perdue. */
	async forget(): Promise<void> {
		if (!this.ephemeral) {
			await keystore.delete(VAULT_KEY);
			await keystore.delete(DEVICE_KEY);
			await keystore.delete(ACTIVE_KEY);
		}
		this.protectedByPassphrase = false;
		this.lock();
		this.status = 'none';
	}

	async setPassphrase(passphrase: string | null): Promise<void> {
		this.#passphrase = passphrase;
		this.protectedByPassphrase = passphrase !== null;
		await this.#persist();
	}

	async confirmBackup(): Promise<void> {
		if (!this.content) return;
		this.content.backedUp = true;
		await this.#persist();
	}

	async selectPseudonym(index: number): Promise<void> {
		this.activeIndex = index;
		if (!this.ephemeral) await keystore.set(ACTIVE_KEY, index);
	}

	/**
	 * Crée un pseudonyme : déclaration signée et preuve de travail envoyées au serveur.
	 * `onProgress` reçoit l'avancement de la preuve de travail (0 à 1).
	 */
	async createPseudonym(
		displayName: string,
		onProgress?: (ratio: number) => void,
		invitation?: string
	) {
		if (!this.content) throw new Error('Identité verrouillée');
		const index = Math.max(-1, ...this.content.pseudonyms.map((p) => p.index)) + 1;
		const keys = this.#keypair(index);
		const challenge = (await (await fetch('/api/pow')).json()) as PowChallenge;
		const pow = await solveChallenge(challenge, onProgress);
		await postJson('/api/pseudonyms', {
			envelope: sign('pseudonym', { displayName }, keys.secretKey),
			pow,
			...(invitation ? { invitation } : {})
		});
		this.content.pseudonyms.push({ index, displayName, registered: true });
		await this.#persist();
		await this.selectPseudonym(index);
	}

	/** Signe un contenu avec le pseudonyme actif. */
	sign<P extends JsonValue>(kind: SignedKind, payload: P): SignedEnvelope<P> {
		if (!this.active) throw new Error('Aucun pseudonyme actif');
		return sign(kind, payload, this.#keypair(this.active.index).secretKey);
	}

	/** Signe et envoie un contenu ; renvoie la réponse JSON du serveur. */
	async submit(path: string, kind: SignedKind, payload: JsonValue): Promise<unknown> {
		return postJson(path, { envelope: this.sign(kind, payload) });
	}

	/** Fichier de clé chiffré par une phrase secrète (Tor Browser, autre appareil). */
	async exportFile(passphrase: string): Promise<Blob> {
		if (!this.content) throw new Error('Identité verrouillée');
		const sealed = await sealWithPassphrase(passphrase, $state.snapshot(this.content));
		return new Blob([JSON.stringify(sealed)], { type: 'application/json' });
	}

	async importFile(sealed: SealedVault, passphrase: string): Promise<void> {
		const content = await openVault(sealed, passphrase);
		this.#load(content);
		await this.#persist();
	}

	/**
	 * Texte de transfert vers un autre appareil (affiché en QR code) : le coffre chiffré par
	 * un code à usage unique, montré à part. Paramètres Argon2id allégés, le code étant aléatoire.
	 */
	async transferText(code: string): Promise<string> {
		if (!this.content) throw new Error('Identité verrouillée');
		const content = $state.snapshot(this.content);
		return encodeTransfer(await sealWithPassphrase(code, content, TRANSFER_ARGON2));
	}

	async importTransfer(text: string, code: string): Promise<void> {
		const sealed = decodeTransfer(text);
		if (!sealed) throw new Error('Texte de transfert invalide');
		await this.importFile(sealed, normalizeTransferCode(code));
	}

	/**
	 * Remplacement de la phrase de récupération (clé compromise, docs/03) : chaque pseudonyme
	 * est recréé sous une nouvelle phrase, puis l'ancien est déplacé vers le nouveau par une
	 * rotation signée par les deux clés. La nouvelle phrase est enregistrée avant toute rotation :
	 * une interruption se reprend sans perte (`pendingMnemonic`).
	 */
	async replaceMnemonic(
		newMnemonic: string,
		onProgress?: (name: string, ratio: number) => void
	): Promise<void> {
		if (!this.content || !this.#seed) throw new Error('Identité verrouillée');
		this.content.pendingMnemonic = normalizeMnemonic(newMnemonic);
		await this.#persist();
		const nextSeed = mnemonicToSeed(this.content.pendingMnemonic);

		for (const pseudonym of this.content.pseudonyms.filter((p) => p.registered)) {
			const old = this.#keypair(pseudonym.index);
			const next = derivePseudonymKeypair(nextSeed, pseudonym.index);
			const move = { from: encodeKey(old.publicKey), to: encodeKey(next.publicKey) };
			const exists = await fetch(`/api/pseudonyms/${move.to}`);
			if (!exists.ok) {
				const challenge = (await (await fetch('/api/pow')).json()) as PowChallenge;
				const pow = await solveChallenge(challenge, (r) => onProgress?.(pseudonym.displayName, r));
				await postJson('/api/pseudonyms', {
					envelope: sign('pseudonym', { displayName: pseudonym.displayName }, next.secretKey),
					pow
				});
			}
			const current = await fetch(`/api/pseudonyms/${move.from}`);
			const info = current.ok ? ((await current.json()) as { movedTo?: string | null }) : null;
			if (info?.movedTo !== move.to) {
				await postJson('/api/rotations', {
					rotation: sign('key-rotation', move, old.secretKey),
					acceptance: sign('key-rotation-accept', move, next.secretKey)
				});
			}
		}

		this.#load({
			mnemonic: this.content.pendingMnemonic,
			pseudonyms: this.content.pseudonyms,
			backedUp: true
		});
		await this.#persist();
	}
}

export const identity = new Identity();
