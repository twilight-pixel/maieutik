/**
 * Fonctions pures du robot d'archivage (scripts/archiver.ts), testées à part.
 * Aucune dépendance au framework : le script les importe directement.
 */
import { isIP } from 'node:net';

/**
 * Vrai si l'adresse IP ne doit jamais être contactée : réseaux privés, boucle locale,
 * lien local, multidiffusion, réservés. Protège contre les requêtes forgées (SSRF).
 *
 * IPv6 : liste blanche plutôt que liste noire. Seul l'espace public 2000::/3 est permis ;
 * les formes qui encapsulent une IPv4 (::ffff:, NAT64) sont jugées sur l'IPv4 qu'elles portent.
 */
export function isBlockedAddress(address: string): boolean {
	const version = isIP(address);
	if (version === 4) return isBlockedIPv4(address);
	if (version !== 6) return true;
	const words = ipv6Words(address);
	const embedded = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
	// ::ffff:a.b.c.d (IPv4 encapsulée), sous forme pointée ou hexadécimale.
	if (words.slice(0, 5).every((w) => w === 0) && words[5] === 0xffff) {
		return isBlockedIPv4(embedded);
	}
	// 64:ff9b::/96 (NAT64) : l'adresse réellement jointe est l'IPv4 embarquée.
	if (words[0] === 0x64 && words[1] === 0xff9b && words.slice(2, 6).every((w) => w === 0)) {
		return isBlockedIPv4(embedded);
	}
	return (
		(words[0] & 0xe000) !== 0x2000 || // hors de 2000::/3 : ::, ::1, ::a.b.c.d, fc00::/7, fe80::/10, ff00::/8…
		(words[0] === 0x2001 && words[1] === 0x0db8) || // 2001:db8::/32 documentation
		(words[0] === 0x2001 && words[1] === 0) || // 2001::/32 Teredo (IPv4 embarquée)
		words[0] === 0x2002 // 2002::/16 6to4 (IPv4 embarquée)
	);
}

/** Les huit mots de 16 bits d'une adresse IPv6 valide (forme compressée ou à IPv4 finale). */
function ipv6Words(address: string): number[] {
	let text = address.toLowerCase().split('%')[0];
	const dotted = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
	if (dotted) {
		const [a, b, c, d] = dotted.slice(1).map(Number);
		text = `${text.slice(0, dotted.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
	}
	const [head, tail] = text.split('::');
	const left = head ? head.split(':') : [];
	const right = tail === undefined ? [] : tail ? tail.split(':') : [];
	const missing = 8 - left.length - right.length;
	return [...left, ...Array(tail === undefined ? 0 : missing).fill('0'), ...right].map((w) =>
		parseInt(w, 16)
	);
}

function isBlockedIPv4(address: string): boolean {
	const [a, b, c] = address.split('.').map(Number);
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 0) ||
		(a === 192 && b === 88 && c === 99) || // relais 6to4
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19)) ||
		(a === 198 && b === 51 && c === 100) || // documentation
		(a === 203 && b === 0 && c === 113) || // documentation
		a >= 224
	);
}

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
		if (code[0] === '#') {
			const value =
				code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
			return value > 0 && value < 0x110000 ? String.fromCodePoint(value) : '';
		}
		return ENTITIES[code.toLowerCase()] ?? whole;
	});
}

export function extractTitle(html: string): string | null {
	const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	const title = match ? decodeEntities(match[1]).replace(/\s+/g, ' ').trim() : '';
	return title ? title.slice(0, 300) : null;
}

/** Texte lisible d'une page HTML : sans scripts, styles ni balises. */
export function htmlToText(html: string): string {
	const text = html
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1\s*>/gi, ' ')
		.replace(
			/<\/?(p|div|br|li|h[1-6]|tr|section|article|blockquote|pre|header|footer)\b[^>]*>/gi,
			'\n'
		)
		.replace(/<[^>]+>/g, ' ');
	return decodeEntities(text)
		.split('\n')
		.map((line) => line.replace(/[ \t\f\v\r]+/g, ' ').trim())
		.filter((line) => line.length > 0)
		.join('\n');
}
