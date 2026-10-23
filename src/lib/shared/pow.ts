/**
 * Preuve de travail anti-abus, sans identité ni CAPTCHA tiers (docs/03, D10).
 *
 * Même protocole qu'Altcha : le serveur choisit un nombre secret, publie
 * SHA-256(sel + nombre) signé par HMAC ; le navigateur retrouve le nombre par force brute.
 * Le serveur ne garde rien : il vérifie la signature, l'expiration et le hachage,
 * et refuse le rejeu d'une solution déjà utilisée.
 */
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export type PowChallenge = {
	algorithm: 'SHA-256';
	/** Sel aléatoire suivi de `?expires=<secondes Unix>`. */
	salt: string;
	challenge: string;
	maxNumber: number;
	signature: string;
};

export type PowSolution = PowChallenge & { number: number };

const sha256Hex = (input: string) => bytesToHex(sha256(utf8ToBytes(input)));

function randomUint32(): number {
	return crypto.getRandomValues(new Uint32Array(1))[0];
}

export function createChallenge(
	hmacKey: Uint8Array,
	{
		maxNumber,
		ttlSeconds,
		now = Date.now()
	}: { maxNumber: number; ttlSeconds: number; now?: number }
): PowChallenge {
	const salt = `${bytesToHex(crypto.getRandomValues(new Uint8Array(12)))}?expires=${Math.floor(now / 1000) + ttlSeconds}`;
	const challenge = sha256Hex(salt + (randomUint32() % (maxNumber + 1)));
	return {
		algorithm: 'SHA-256',
		salt,
		challenge,
		maxNumber,
		signature: bytesToHex(hmac(sha256, hmacKey, utf8ToBytes(challenge)))
	};
}

/** Retrouve le nombre secret. Rend la main régulièrement pour ne pas figer la page. */
export async function solveChallenge(
	challenge: PowChallenge,
	onProgress?: (ratio: number) => void
): Promise<PowSolution> {
	const chunk = 5_000;
	for (let start = 0; start <= challenge.maxNumber; start += chunk) {
		const end = Math.min(start + chunk - 1, challenge.maxNumber);
		for (let number = start; number <= end; number++) {
			if (sha256Hex(challenge.salt + number) === challenge.challenge) {
				return { ...challenge, number };
			}
		}
		onProgress?.(end / challenge.maxNumber);
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	throw new Error('Preuve de travail introuvable');
}

export function verifySolution(hmacKey: Uint8Array, solution: unknown, now = Date.now()): boolean {
	if (typeof solution !== 'object' || solution === null) return false;
	const s = solution as Partial<PowSolution>;
	if (
		s.algorithm !== 'SHA-256' ||
		typeof s.salt !== 'string' ||
		typeof s.challenge !== 'string' ||
		typeof s.signature !== 'string' ||
		!Number.isInteger(s.number) ||
		!Number.isInteger(s.maxNumber) ||
		(s.number as number) < 0 ||
		(s.number as number) > (s.maxNumber as number)
	) {
		return false;
	}
	const expires = Number(new URLSearchParams(s.salt.split('?')[1] ?? '').get('expires'));
	if (!Number.isFinite(expires) || expires * 1000 < now) return false;
	const expected = bytesToHex(hmac(sha256, hmacKey, utf8ToBytes(s.challenge)));
	if (!constantTimeEqual(expected, s.signature)) return false;
	return sha256Hex(s.salt + s.number) === s.challenge;
}

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
