import { describe, expect, it } from 'vitest';
import { extractTitle, htmlToText, isBlockedAddress } from './archive-safety';

describe('robot d’archivage', () => {
	it('bloque les adresses internes et réservées', () => {
		for (const address of [
			'127.0.0.1',
			'10.1.2.3',
			'172.20.0.5',
			'192.168.1.1',
			'169.254.169.254',
			'100.64.0.1',
			'0.0.0.0',
			'224.0.0.1',
			'::1',
			'::',
			'fd00::1',
			'fe80::1',
			'::ffff:127.0.0.1',
			'64:ff9b::10.0.0.1',
			// Formes IPv6 qui échappaient à l'ancienne liste noire.
			'::7f00:1',
			'::127.0.0.1',
			'::ffff:7f00:1',
			'64:ff9b::a9fe:a9fe',
			'64:ff9b:1::1',
			'2002:7f00:1::',
			'2001:0:4136:e378::1',
			'2001:db8::1',
			'fec0::1',
			'100::1',
			'5f00::1',
			'fe80::1%eth0',
			'192.88.99.1',
			'198.51.100.7',
			'203.0.113.77',
			'pas-une-ip'
		]) {
			expect(isBlockedAddress(address), address).toBe(true);
		}
	});

	it('autorise les adresses publiques', () => {
		for (const address of [
			'93.184.215.14',
			'1.1.1.1',
			'2606:4700:4700::1111',
			'2a00:1450:4007:80e::200e',
			'::ffff:1.1.1.1',
			'64:ff9b::101:101'
		]) {
			expect(isBlockedAddress(address), address).toBe(false);
		}
	});

	it('extrait un texte sans scripts ni balises', () => {
		const html = `<html><head><title>Titre &amp; sous-titre</title><style>p{}</style></head>
			<body><script>alert(1)</script><h1>Bonjour</h1><p>Un <b>texte</b>&nbsp;utile &#233;crit.</p>
			<!-- commentaire --></body></html>`;
		expect(extractTitle(html)).toBe('Titre & sous-titre');
		const text = htmlToText(html);
		expect(text).toContain('Bonjour');
		expect(text).toContain('Un texte utile écrit.');
		expect(text).not.toContain('alert');
		expect(text).not.toContain('commentaire');
		expect(text).not.toContain('<');
	});
});
