/**
 * Limites de débit en mémoire, par clé de pseudonyme (jamais par adresse IP, docs/03).
 * Rien n'est écrit sur disque ; un redémarrage remet les compteurs à zéro.
 */
type Bucket = { tokens: number; updated: number };

export class RateLimiter {
	readonly #buckets = new Map<string, Bucket>();

	constructor(
		private readonly capacity: number,
		private readonly refillPerHour: number
	) {}

	/** Consomme un jeton pour `key` ; faux si la limite est atteinte. */
	take(key: string, now = Date.now()): boolean {
		const bucket = this.#buckets.get(key) ?? { tokens: this.capacity, updated: now };
		const refill = ((now - bucket.updated) / 3_600_000) * this.refillPerHour;
		bucket.tokens = Math.min(this.capacity, bucket.tokens + refill);
		bucket.updated = now;
		if (bucket.tokens < 1) {
			this.#buckets.set(key, bucket);
			return false;
		}
		bucket.tokens -= 1;
		this.#buckets.set(key, bucket);
		if (this.#buckets.size > 100_000) this.#prune(now);
		return true;
	}

	#prune(now: number) {
		for (const [key, bucket] of this.#buckets) {
			const full = bucket.tokens + ((now - bucket.updated) / 3_600_000) * this.refillPerHour;
			if (full >= this.capacity) this.#buckets.delete(key);
		}
	}
}

export const limits = {
	/** Publications et nouvelles versions. */
	texts: new RateLimiter(10, 10),
	reports: new RateLimiter(10, 2),
	withdrawals: new RateLimiter(10, 10),
	questions: new RateLimiter(5, 2)
};

/** Solutions de preuve de travail déjà utilisées, oubliées après expiration du défi. */
const usedChallenges = new Map<string, number>();

export function claimChallenge(challenge: string, expiresAtMs: number, now = Date.now()): boolean {
	for (const [key, expires] of usedChallenges) if (expires < now) usedChallenges.delete(key);
	if (usedChallenges.has(challenge)) return false;
	usedChallenges.set(challenge, expiresAtMs);
	return true;
}
