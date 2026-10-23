/**
 * JSON canonique selon la RFC 8785 (JCS).
 *
 * Ce module est la base des signatures : le client et le serveur doivent produire
 * exactement les mêmes octets pour une même valeur. Toute modification doit garder
 * les tests de propriété verts (voir canonical-json.spec.ts).
 */

export type JsonValue =
	null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export class CanonicalJsonError extends Error {}

/** Sérialise une valeur JSON sous sa forme canonique RFC 8785. */
export function canonicalize(value: unknown): string {
	return serialize(value, '$');
}

/** Forme canonique encodée en UTF-8, prête à être signée. */
export function canonicalBytes(value: unknown): Uint8Array {
	return new TextEncoder().encode(canonicalize(value));
}

function serialize(value: unknown, path: string): string {
	if (value === null) return 'null';

	switch (typeof value) {
		case 'boolean':
			return value ? 'true' : 'false';
		case 'number':
			if (!Number.isFinite(value)) {
				throw new CanonicalJsonError(`${path} : nombre non fini interdit`);
			}
			// La sérialisation ECMAScript des nombres est celle exigée par la RFC 8785.
			return JSON.stringify(value);
		case 'string':
			return serializeString(value, path);
		case 'object':
			if (Array.isArray(value)) {
				return '[' + value.map((item, i) => serialize(item, `${path}[${i}]`)).join(',') + ']';
			}
			if (
				Object.getPrototypeOf(value) !== Object.prototype &&
				Object.getPrototypeOf(value) !== null
			) {
				throw new CanonicalJsonError(`${path} : seuls les objets simples sont acceptés`);
			}
			return serializeObject(value as Record<string, unknown>, path);
		default:
			throw new CanonicalJsonError(`${path} : type ${typeof value} non sérialisable`);
	}
}

function serializeObject(object: Record<string, unknown>, path: string): string {
	// Le tri par défaut de JavaScript compare les unités de code UTF-16, comme l'exige la RFC.
	const keys = Object.keys(object).sort();
	const members: string[] = [];
	for (const key of keys) {
		const member = object[key];
		if (member === undefined) {
			throw new CanonicalJsonError(`${path}.${key} : valeur undefined interdite`);
		}
		members.push(
			serializeString(key, `${path}.${key}`) + ':' + serialize(member, `${path}.${key}`)
		);
	}
	return '{' + members.join(',') + '}';
}

/** Vrai si la chaîne contient une moitié de paire de substitution isolée (UTF-16 mal formé). */
function hasLoneSurrogate(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const unit = value.charCodeAt(i);
		if (unit >= 0xd800 && unit <= 0xdbff) {
			const next = value.charCodeAt(i + 1);
			if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
			i++;
		} else if (unit >= 0xdc00 && unit <= 0xdfff) {
			return true;
		}
	}
	return false;
}

function serializeString(value: string, path: string): string {
	if (hasLoneSurrogate(value)) {
		throw new CanonicalJsonError(`${path} : chaîne Unicode mal formée (surrogate isolé)`);
	}
	// JSON.stringify applique les échappements imposés par la RFC 8785 (§3.2.2.2).
	return JSON.stringify(value);
}
