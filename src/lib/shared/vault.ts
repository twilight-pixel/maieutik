/**
 * Coffre local : la phrase de récupération et la liste des pseudonymes, chiffrées (docs/03, D06).
 *
 * Deux protections :
 * - `device` : clé AES-GCM non extractible conservée par le navigateur (IndexedDB).
 *   Protège contre la lecture brute du stockage, pas contre un accès à la session ouverte ;
 * - `passphrase` : clé dérivée d'une phrase secrète par Argon2id. Sert aussi au fichier
 *   de clé chiffré, utile dans Tor Browser où le stockage est effacé à la fermeture.
 *
 * WebCrypto (AES-GCM) existe à l'identique dans le navigateur et dans Node.
 */
import { argon2idAsync } from '@noble/hashes/argon2.js';
import { base64urlnopad } from '@scure/base';

export type VaultContent = {
	mnemonic: string;
	pseudonyms: { index: number; displayName: string; registered: boolean }[];
	/** La sauvegarde de la phrase a été confirmée par l'utilisateur. */
	backedUp: boolean;
	/** Nouvelle phrase en cours d'adoption (rotation de clé interrompue, à reprendre). */
	pendingMnemonic?: string;
};

export type Argon2Params = { t: number; m: number; p: number };

export type SealedVault =
	| { v: 1; kdf: 'device'; nonce: string; ciphertext: string }
	| {
			v: 1;
			kdf: 'argon2id';
			params: Argon2Params;
			salt: string;
			nonce: string;
			ciphertext: string;
	  };

/** Paramètres Argon2id recommandés par l'OWASP (19 Mio, 2 passes). */
export const DEFAULT_ARGON2: Argon2Params = { t: 2, m: 19_456, p: 1 };

export const MIN_PASSPHRASE_LENGTH = 10;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function createDeviceKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function passphraseKey(passphrase: string, salt: Uint8Array, params: Argon2Params) {
	const raw = await argon2idAsync(encoder.encode(passphrase.normalize('NFKC')), salt, {
		...params,
		dkLen: 32
	});
	return crypto.subtle.importKey('raw', raw as Uint8Array<ArrayBuffer>, 'AES-GCM', false, [
		'encrypt',
		'decrypt'
	]);
}

async function encrypt(key: CryptoKey, content: VaultContent) {
	const nonce = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: nonce },
		key,
		encoder.encode(JSON.stringify(content))
	);
	return {
		nonce: base64urlnopad.encode(nonce),
		ciphertext: base64urlnopad.encode(new Uint8Array(ciphertext))
	};
}

async function decrypt(key: CryptoKey, nonce: string, ciphertext: string): Promise<VaultContent> {
	const plain = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: base64urlnopad.decode(nonce) as Uint8Array<ArrayBuffer> },
		key,
		base64urlnopad.decode(ciphertext) as Uint8Array<ArrayBuffer>
	);
	return JSON.parse(decoder.decode(plain)) as VaultContent;
}

export async function sealWithDeviceKey(
	key: CryptoKey,
	content: VaultContent
): Promise<SealedVault> {
	return { v: 1, kdf: 'device', ...(await encrypt(key, content)) };
}

export async function sealWithPassphrase(
	passphrase: string,
	content: VaultContent,
	params: Argon2Params = DEFAULT_ARGON2
): Promise<SealedVault> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await passphraseKey(passphrase, salt, params);
	return {
		v: 1,
		kdf: 'argon2id',
		params,
		salt: base64urlnopad.encode(salt),
		...(await encrypt(key, content))
	};
}

export class WrongPassphraseError extends Error {}

/** Ouvre un coffre. `secret` est la clé de l'appareil ou la phrase secrète, selon `kdf`. */
export async function openVault(
	vault: SealedVault,
	secret: CryptoKey | string
): Promise<VaultContent> {
	try {
		if (vault.kdf === 'device') {
			if (typeof secret === 'string') throw new Error('clé d’appareil attendue');
			return await decrypt(secret, vault.nonce, vault.ciphertext);
		}
		if (typeof secret !== 'string') throw new Error('phrase secrète attendue');
		const key = await passphraseKey(secret, base64urlnopad.decode(vault.salt), vault.params);
		return await decrypt(key, vault.nonce, vault.ciphertext);
	} catch (error) {
		if (error instanceof Error && error.name === 'OperationError') throw new WrongPassphraseError();
		throw error;
	}
}

/** Contrôle minimal d'un fichier de coffre importé (avant de demander la phrase secrète). */
export function parseSealedVault(input: unknown): SealedVault | null {
	if (typeof input !== 'object' || input === null) return null;
	const v = input as Record<string, unknown>;
	if (v.v !== 1 || typeof v.nonce !== 'string' || typeof v.ciphertext !== 'string') return null;
	if (v.kdf === 'device') return v as SealedVault;
	if (v.kdf !== 'argon2id' || typeof v.salt !== 'string') return null;
	const params = v.params as Argon2Params | undefined;
	if (
		!params ||
		![params.t, params.m, params.p].every(Number.isInteger) ||
		params.t < 1 ||
		params.t > 10 ||
		params.m < 8 ||
		params.m > 262_144 ||
		params.p !== 1
	) {
		return null;
	}
	return v as SealedVault;
}

// ---------------------------------------------------------------------------
// Transfert entre appareils (QR code)

/** Préfixe du texte de transfert (version du format). */
const TRANSFER_PREFIX = 'MAIEUTIK1:';
/** Le code de transfert est aléatoire (environ 60 bits) : Argon2id allégé suffit. */
export const TRANSFER_ARGON2: Argon2Params = { t: 1, m: 8_192, p: 1 };
const TRANSFER_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Code de transfert lisible : trois groupes de quatre caractères. */
export function newTransferCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(12));
	const chars = [...bytes].map((b) => TRANSFER_ALPHABET[b % TRANSFER_ALPHABET.length]);
	return [0, 4, 8].map((i) => chars.slice(i, i + 4).join('')).join('-');
}

export function normalizeTransferCode(code: string): string {
	const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
	return [0, 4, 8].map((i) => clean.slice(i, i + 4)).join('-');
}

export function encodeTransfer(sealed: SealedVault): string {
	return TRANSFER_PREFIX + base64urlnopad.encode(encoder.encode(JSON.stringify(sealed)));
}

export function decodeTransfer(text: string): SealedVault | null {
	const raw = text.trim();
	if (!raw.startsWith(TRANSFER_PREFIX)) return null;
	try {
		return parseSealedVault(
			JSON.parse(decoder.decode(base64urlnopad.decode(raw.slice(TRANSFER_PREFIX.length))))
		);
	} catch {
		return null;
	}
}
