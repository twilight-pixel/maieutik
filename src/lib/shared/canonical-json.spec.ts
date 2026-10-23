import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { canonicalize, CanonicalJsonError } from './canonical-json';

describe('canonicalize', () => {
	it('trie les clés par unités de code UTF-16 (exemple RFC 8785 §3.2.3)', () => {
		const c = (...codePoints: number[]) => String.fromCodePoint(...codePoints);
		const keys = [c(0x20ac), c(0x0d), c(0xfb33), c(0x31), c(0x1f600), c(0x80), c(0xf6)];
		const input = Object.fromEntries(keys.map((key) => [key, key.codePointAt(0)]));
		const order = [c(0x0d), c(0x31), c(0x80), c(0xf6), c(0x20ac), c(0x1f600), c(0xfb33)];
		// Comparaison sur la chaîne : Object.keys placerait toujours la clé numérique « 1 » en tête.
		const expected =
			'{' + order.map((key) => JSON.stringify(key) + ':' + key.codePointAt(0)).join(',') + '}';
		expect(canonicalize(input)).toBe(expected);
	});

	it('sérialise les nombres selon ECMAScript (exemples RFC 8785 annexe B)', () => {
		const cases: [number, string][] = [
			[0, '0'],
			[-0, '0'],
			[1e21, '1e+21'],
			[1e-7, '1e-7'],
			[333333333.3333332, '333333333.3333332'],
			[4.5, '4.5'],
			[0.002, '0.002'],
			[9007199254740992, '9007199254740992'],
			[5e-324, '5e-324']
		];
		for (const [value, expected] of cases) expect(canonicalize(value)).toBe(expected);
	});

	it('reproduit l’exemple de la RFC 8785 §3.2.2', () => {
		const ch = String.fromCharCode;
		const bs = ch(0x5c);
		const input = {
			numbers: [Number('333333333.33333329'), 1e30, 4.5, 2e-3, 0.000000000000000000000000001],
			string: ch(0x20ac) + '$' + ch(0x0f) + ch(0x0a) + "A'B" + '"' + bs + bs + '"/',
			literals: [null, true, false]
		};
		const expectedString =
			'"' +
			ch(0x20ac) +
			'$' +
			bs +
			'u000f' +
			bs +
			"nA'B" +
			bs +
			'"' +
			bs +
			bs +
			bs +
			bs +
			bs +
			'"/"';
		expect(canonicalize(input)).toBe(
			'{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],' +
				'"string":' +
				expectedString +
				'}'
		);
	});

	it('refuse les valeurs non représentables', () => {
		for (const bad of [
			NaN,
			Infinity,
			undefined,
			() => 1,
			1n,
			new Date(0),
			{ a: undefined },
			String.fromCharCode(0xd800)
		]) {
			expect(() => canonicalize(bad)).toThrow(CanonicalJsonError);
		}
	});

	it('propriété : idempotente et stable quel que soit l’ordre des clés', () => {
		fc.assert(
			fc.property(fc.jsonValue(), (value) => {
				const once = canonicalize(value);
				expect(canonicalize(JSON.parse(once))).toBe(once);
				expect(JSON.parse(once)).toEqual(JSON.parse(JSON.stringify(value)));
			})
		);
	});

	it('propriété : l’ordre d’insertion des clés n’a pas d’effet', () => {
		fc.assert(
			fc.property(fc.dictionary(fc.string(), fc.jsonValue()), (object) => {
				const reversed = Object.fromEntries(Object.entries(object).reverse());
				expect(canonicalize(reversed)).toBe(canonicalize(object));
			})
		);
	});
});
