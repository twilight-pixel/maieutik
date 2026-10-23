/**
 * Identité par clé (D01, D06) : graine BIP39 → clés Ed25519 dérivées selon SLIP-0010.
 *
 * Une même graine peut dériver plusieurs pseudonymes (un par index), sans lien
 * public entre eux. Ce module tourne côté navigateur (création, signature) et côté
 * serveur (vérification, calcul de l'empreinte).
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import {
	entropyToMnemonic,
	generateMnemonic,
	mnemonicToSeedSync,
	validateMnemonic
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

/**
 * Chemin de dérivation des pseudonymes : m/44'/<COIN>'/<index>'.
 * Valeur propre au projet ; ne jamais la changer, sinon les graines existantes
 * ne retrouveraient plus leurs pseudonymes.
 */
const PURPOSE = 44;
const COIN = 0x6d61_6965 & 0x7fff_ffff; // « maie »
const HARDENED = 0x8000_0000;

export interface Keypair {
	secretKey: Uint8Array;
	publicKey: Uint8Array;
}

/** Génère une phrase de récupération (12 mots par défaut, 24 avec strength = 256). */
export function createMnemonic(strength: 128 | 256 = 128): string {
	return generateMnemonic(wordlist, strength);
}

/** Phrase déterministe à partir d'une entropie de 16 ou 32 octets (données de test, scripts/seed.ts). */
export function mnemonicFromEntropy(entropy: Uint8Array): string {
	return entropyToMnemonic(entropy, wordlist);
}

export function isValidMnemonic(mnemonic: string): boolean {
	return validateMnemonic(normalizeMnemonic(mnemonic), wordlist);
}

export function normalizeMnemonic(mnemonic: string): string {
	return mnemonic.trim().toLowerCase().split(/\s+/).join(' ');
}

export function mnemonicToSeed(mnemonic: string): Uint8Array {
	const normalized = normalizeMnemonic(mnemonic);
	if (!validateMnemonic(normalized, wordlist)) throw new Error('Phrase de récupération invalide');
	return mnemonicToSeedSync(normalized);
}

/** Dérivation SLIP-0010 pour Ed25519 (indices durcis uniquement). */
export function deriveSlip10(
	seed: Uint8Array,
	path: number[]
): { key: Uint8Array; chainCode: Uint8Array } {
	let digest = hmac(sha512, utf8ToBytes('ed25519 seed'), seed);
	let key = digest.slice(0, 32);
	let chainCode = digest.slice(32);
	for (const index of path) {
		if (!Number.isInteger(index) || index < 0 || index >= HARDENED) {
			throw new Error(`Index de dérivation invalide : ${index}`);
		}
		const data = new Uint8Array(37);
		data.set(key, 1);
		new DataView(data.buffer).setUint32(33, index + HARDENED, false);
		digest = hmac(sha512, chainCode, data);
		key = digest.slice(0, 32);
		chainCode = digest.slice(32);
	}
	return { key, chainCode };
}

/** Clés du pseudonyme n° `index` issu d'une graine. */
export function derivePseudonymKeypair(seed: Uint8Array, index = 0): Keypair {
	const { key } = deriveSlip10(seed, [PURPOSE, COIN, index]);
	return { secretKey: key, publicKey: ed25519.getPublicKey(key) };
}

/**
 * Suffixe d'empreinte immuable affiché après le nom (ex. `Hypatie#a3f9`).
 * L'unicité est garantie par la contrainte (nom, empreinte) en base.
 */
export function fingerprint(publicKey: Uint8Array, length = 4): string {
	return bytesToHex(sha256(publicKey)).slice(0, length);
}

export function displayHandle(displayName: string, publicKey: Uint8Array): string {
	return `${displayName}#${fingerprint(publicKey)}`;
}
