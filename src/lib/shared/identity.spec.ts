import { describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import {
	createMnemonic,
	derivePseudonymKeypair,
	deriveSlip10,
	displayHandle,
	fingerprint,
	isValidMnemonic,
	mnemonicToSeed
} from './identity';

describe('SLIP-0010 Ed25519 (vecteur de test 1 de la spécification)', () => {
	const seed = hexToBytes('000102030405060708090a0b0c0d0e0f');

	it('dérive la clé maîtresse', () => {
		const { key, chainCode } = deriveSlip10(seed, []);
		expect(bytesToHex(chainCode)).toBe(
			'90046a93de5380a72b5e45010748567d5ea02bbf6522f979e05c0d8d8ca9fffb'
		);
		expect(bytesToHex(key)).toBe(
			'2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7'
		);
		expect(bytesToHex(ed25519.getPublicKey(key))).toBe(
			'a4b2856bfec510abab89753fac1ac0e1112364e7d250545963f135f2a33188ed'
		);
	});

	it('dérive m/0H', () => {
		const { key, chainCode } = deriveSlip10(seed, [0]);
		expect(bytesToHex(chainCode)).toBe(
			'8b59aa11380b624e81507a27fedda59fea6d0b779a778918a2fd3590e16e9c69'
		);
		expect(bytesToHex(key)).toBe(
			'68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3'
		);
	});

	it('refuse les index hors plage', () => {
		expect(() => deriveSlip10(seed, [-1])).toThrow();
		expect(() => deriveSlip10(seed, [0x8000_0000])).toThrow();
	});
});

describe('pseudonymes', () => {
	it('retrouve le même pseudonyme depuis la même phrase (D06)', () => {
		const mnemonic = createMnemonic();
		expect(isValidMnemonic(mnemonic)).toBe(true);
		const a = derivePseudonymKeypair(mnemonicToSeed(mnemonic));
		const b = derivePseudonymKeypair(mnemonicToSeed(`  ${mnemonic.toUpperCase()}  `));
		expect(bytesToHex(b.publicKey)).toBe(bytesToHex(a.publicKey));
	});

	it('dérive des pseudonymes distincts par index', () => {
		const seed = mnemonicToSeed(createMnemonic());
		const first = derivePseudonymKeypair(seed, 0);
		const second = derivePseudonymKeypair(seed, 1);
		expect(bytesToHex(first.publicKey)).not.toBe(bytesToHex(second.publicKey));
	});

	it('refuse une phrase invalide', () => {
		expect(isValidMnemonic('abandon abandon abandon')).toBe(false);
		expect(() => mnemonicToSeed('pas une phrase valide')).toThrow();
	});

	it('affiche le nom avec un suffixe d’empreinte stable', () => {
		const { publicKey } = derivePseudonymKeypair(mnemonicToSeed(createMnemonic()));
		expect(fingerprint(publicKey)).toMatch(/^[0-9a-f]{4}$/);
		expect(displayHandle('Hypatie', publicKey)).toBe(`Hypatie#${fingerprint(publicKey)}`);
	});
});
