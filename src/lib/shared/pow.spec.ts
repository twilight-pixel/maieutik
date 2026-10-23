import { describe, expect, it } from 'vitest';
import { createChallenge, solveChallenge, verifySolution } from './pow';

const key = crypto.getRandomValues(new Uint8Array(32));

describe('preuve de travail', () => {
	it('résout et vérifie un défi', async () => {
		const challenge = createChallenge(key, { maxNumber: 2_000, ttlSeconds: 60 });
		const solution = await solveChallenge(challenge);
		expect(verifySolution(key, solution)).toBe(true);
	});

	it('refuse une solution fausse, expirée, falsifiée ou signée par une autre clé', async () => {
		const challenge = createChallenge(key, { maxNumber: 2_000, ttlSeconds: 60 });
		const solution = await solveChallenge(challenge);
		expect(verifySolution(key, { ...solution, number: solution.number + 1 })).toBe(false);
		expect(verifySolution(key, solution, Date.now() + 61_000)).toBe(false);
		expect(verifySolution(crypto.getRandomValues(new Uint8Array(32)), solution)).toBe(false);
		const extended = solution.salt.replace(/expires=\d+/, 'expires=9999999999');
		expect(verifySolution(key, { ...solution, salt: extended })).toBe(false);
		expect(verifySolution(key, null)).toBe(false);
	});
});
