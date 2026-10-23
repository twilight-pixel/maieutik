import { describe, expect, it } from 'vitest';
import { claimChallenge, RateLimiter } from './rate-limit';

describe('limites de débit', () => {
	it('consomme puis recharge les jetons', () => {
		const limiter = new RateLimiter(2, 1);
		const t0 = 1_000_000;
		expect(limiter.take('k', t0)).toBe(true);
		expect(limiter.take('k', t0)).toBe(true);
		expect(limiter.take('k', t0)).toBe(false);
		expect(limiter.take('autre', t0)).toBe(true);
		expect(limiter.take('k', t0 + 3_600_000)).toBe(true);
	});

	it('refuse le rejeu d’un défi', () => {
		const now = Date.now();
		expect(claimChallenge('abc', now + 1000, now)).toBe(true);
		expect(claimChallenge('abc', now + 1000, now)).toBe(false);
		expect(claimChallenge('abc', now + 1000, now + 2000)).toBe(true);
	});
});
