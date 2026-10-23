import { describe, expect, it } from 'vitest';
import { drawJurors, eligibleHash, JURY, juryOutcome, seedCommitment } from './jury';

const keys = Array.from({ length: 40 }, (_, i) => `cle-${i.toString().padStart(2, '0')}`);
const seed = 'a'.repeat(64);
const report = crypto.randomUUID();

describe('tirage du jury', () => {
	it('est déterministe et indépendant de l’ordre de la liste', () => {
		const first = drawJurors(seed, report, keys, JURY.size);
		const shuffled = [...keys].reverse();
		expect(first).toHaveLength(JURY.size);
		expect(drawJurors(seed, report, shuffled, JURY.size)).toEqual(first);
		expect(new Set(first).size).toBe(JURY.size);
		expect(eligibleHash(shuffled)).toBe(eligibleHash(keys));
	});

	it('change avec la graine et avec le signalement', () => {
		const first = drawJurors(seed, report, keys, JURY.size);
		expect(drawJurors('b'.repeat(64), report, keys, JURY.size)).not.toEqual(first);
		expect(drawJurors(seed, crypto.randomUUID(), keys, JURY.size)).not.toEqual(first);
	});

	it('engage la graine sans la révéler', () => {
		expect(seedCommitment(seed)).toMatch(/^[0-9a-f]{64}$/);
		expect(seedCommitment(seed)).not.toContain(seed);
		expect(seedCommitment(seed)).not.toBe(seedCommitment('b'.repeat(64)));
	});

	it('applique la majorité des deux tiers et le quorum', () => {
		expect(juryOutcome({ illegal: 6, legal: 3 }, { closing: false })).toBe('illegal');
		expect(juryOutcome({ illegal: 5, legal: 4 }, { closing: false })).toBe('legal');
		expect(juryOutcome({ illegal: 3, legal: 0 }, { closing: false })).toBe('pending');
		expect(juryOutcome({ illegal: 4, legal: 2 }, { closing: true })).toBe('illegal');
		expect(juryOutcome({ illegal: 2, legal: 2 }, { closing: true })).toBe('escalated');
	});
});
