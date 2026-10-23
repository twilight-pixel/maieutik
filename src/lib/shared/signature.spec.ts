import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createMnemonic, derivePseudonymKeypair, mnemonicToSeed } from './identity';
import { sign, verify } from './signature';

const { secretKey } = derivePseudonymKeypair(mnemonicToSeed(createMnemonic()));

describe('enveloppes signées', () => {
	it('vérifie une signature valide, y compris après aller-retour JSON', () => {
		const envelope = sign('text-version', { b: 1, a: ['é', null, true] }, secretKey);
		expect(verify(envelope)).toBe(true);
		expect(verify(JSON.parse(JSON.stringify(envelope)))).toBe(true);
	});

	it('ne dépend pas de l’ordre des clés du contenu', () => {
		const envelope = sign('text-version', { a: 1, b: 2 }, secretKey);
		expect(verify({ ...envelope, payload: { b: 2, a: 1 } })).toBe(true);
	});

	it('rejette un contenu modifié', () => {
		const envelope = sign('text-version', { title: 'Original' }, secretKey);
		expect(verify({ ...envelope, payload: { title: 'Modifié' } })).toBe(false);
	});

	it('rejette le rejeu sous un autre type d’objet', () => {
		const envelope = sign('text-version', { id: 'x' }, secretKey);
		expect(verify({ ...envelope, kind: 'text-withdrawal' })).toBe(false);
	});

	it('rejette une clé publique ou une signature mal formée', () => {
		const envelope = sign('report', {}, secretKey);
		expect(verify({ ...envelope, publicKey: 'abc' })).toBe(false);
		expect(verify({ ...envelope, signature: '!!' })).toBe(false);
	});

	it('propriété : toute valeur JSON signée se vérifie après sérialisation', () => {
		fc.assert(
			fc.property(fc.jsonValue(), (payload) => {
				const normalized = JSON.parse(JSON.stringify(payload));
				const envelope = JSON.parse(JSON.stringify(sign('text-version', normalized, secretKey)));
				expect(verify(envelope)).toBe(true);
			}),
			{ numRuns: 50 }
		);
	});
});
