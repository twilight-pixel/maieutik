import { describe, expect, it } from 'vitest';
import {
	createDeviceKey,
	openVault,
	parseSealedVault,
	sealWithDeviceKey,
	sealWithPassphrase,
	WrongPassphraseError,
	type VaultContent
} from './vault';

const content: VaultContent = {
	mnemonic: 'abandon ability able about above absent absorb abstract absurd abuse access accident',
	pseudonyms: [{ index: 0, displayName: 'Hypatie', registered: true }],
	backedUp: false
};
// Paramètres réduits pour la vitesse des tests uniquement.
const fast = { t: 1, m: 64, p: 1 };

describe('coffre local', () => {
	it('chiffre et déchiffre avec la clé de l’appareil', async () => {
		const key = await createDeviceKey();
		const vault = await sealWithDeviceKey(key, content);
		expect(vault.ciphertext).not.toContain('abandon');
		expect(await openVault(vault, key)).toEqual(content);
	});

	it('chiffre avec une phrase secrète et refuse la mauvaise', async () => {
		const vault = await sealWithPassphrase('une longue phrase secrète', content, fast);
		expect(parseSealedVault(JSON.parse(JSON.stringify(vault)))).toEqual(vault);
		expect(await openVault(vault, 'une longue phrase secrète')).toEqual(content);
		await expect(openVault(vault, 'mauvaise phrase secrète')).rejects.toBeInstanceOf(
			WrongPassphraseError
		);
	});

	it('rejette un fichier de coffre aux paramètres dangereux', () => {
		const vault = { v: 1, kdf: 'argon2id', salt: 'a', nonce: 'b', ciphertext: 'c' };
		expect(parseSealedVault({ ...vault, params: { t: 1, m: 4_000_000, p: 1 } })).toBeNull();
		expect(parseSealedVault({ v: 2 })).toBeNull();
	});
});
