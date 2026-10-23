/**
 * Enveloppes signées : chaque objet publié (version de texte, retrait, rotation de clé…)
 * est signé par la clé du pseudonyme sur sa forme JSON canonique.
 *
 * Le message signé est préfixé par un séparateur de domaine incluant le type d'objet,
 * pour qu'une signature valide pour un type ne puisse pas être rejouée pour un autre.
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import { base64urlnopad } from '@scure/base';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { canonicalBytes, type JsonValue } from './canonical-json';

const DOMAIN = 'maieutik/v1/';

/** Types d'objets signables. En ajouter un ici avant de l'utiliser ; ne jamais en renommer. */
export type SignedKind =
	| 'pseudonym'
	| 'text-version'
	| 'question'
	| 'text-withdrawal'
	| 'report'
	| 'moderation-decision'
	| 'referent-access'
	| 'key-rotation'
	| 'key-rotation-accept'
	| 'jury-volunteer'
	| 'jury-access'
	| 'jury-vote'
	| 'question-report'
	| 'appeal'
	| 'invitation-create';

export type SignedEnvelope<P extends JsonValue = JsonValue> = {
	kind: SignedKind;
	payload: P;
	/** Clé publique Ed25519, base64url sans remplissage. */
	publicKey: string;
	/** Signature Ed25519, base64url sans remplissage. */
	signature: string;
};

export function signingMessage(kind: SignedKind, payload: JsonValue): Uint8Array {
	return concatBytes(utf8ToBytes(`${DOMAIN}${kind}\n`), canonicalBytes(payload));
}

export function sign<P extends JsonValue>(
	kind: SignedKind,
	payload: P,
	secretKey: Uint8Array
): SignedEnvelope<P> {
	const signature = ed25519.sign(signingMessage(kind, payload), secretKey);
	return {
		kind,
		payload,
		publicKey: encodeKey(ed25519.getPublicKey(secretKey)),
		signature: base64urlnopad.encode(signature)
	};
}

/** Vérification stricte (RFC 8032, sans ZIP-215) : refuse les encodages non canoniques. */
export function verify(envelope: SignedEnvelope): boolean {
	try {
		return ed25519.verify(
			base64urlnopad.decode(envelope.signature),
			signingMessage(envelope.kind, envelope.payload),
			decodeKey(envelope.publicKey),
			{ zip215: false }
		);
	} catch {
		return false;
	}
}

export function encodeKey(publicKey: Uint8Array): string {
	return base64urlnopad.encode(publicKey);
}

export function decodeKey(encoded: string): Uint8Array {
	const bytes = base64urlnopad.decode(encoded);
	if (bytes.length !== 32) throw new Error('Clé publique Ed25519 invalide');
	return bytes;
}
