import { json } from '@sveltejs/kit';
import { decodeKey, verify, type SignedEnvelope, type SignedKind } from '#lib/shared/signature.js';

/** Erreur métier renvoyée telle quelle au client, sans détail interne. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

export function errorResponse(error: unknown): Response {
	if (error instanceof ApiError) return json({ error: error.message }, { status: error.status });
	// Aucune donnée de requête dans les journaux : seul le type d'erreur est consigné.
	console.error('erreur interne', error instanceof Error ? error.name : typeof error);
	return json({ error: 'Erreur interne' }, { status: 500 });
}

export type VerifiedEnvelope = {
	envelope: SignedEnvelope;
	publicKey: Uint8Array;
	payload: unknown;
};

/** Lit le corps JSON et vérifie l'enveloppe signée qu'il contient sous `field`. */
export async function readSignedRequest(
	request: Request,
	kind: SignedKind,
	field = 'envelope'
): Promise<{ verified: VerifiedEnvelope; body: Record<string, unknown> }> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw new ApiError(400, 'Corps JSON attendu');
	}
	if (typeof body !== 'object' || body === null) throw new ApiError(400, 'Corps JSON attendu');
	const envelope = (body as Record<string, unknown>)[field] as SignedEnvelope | undefined;
	if (
		!envelope ||
		typeof envelope !== 'object' ||
		envelope.kind !== kind ||
		typeof envelope.publicKey !== 'string' ||
		typeof envelope.signature !== 'string' ||
		!('payload' in envelope)
	) {
		throw new ApiError(400, 'Enveloppe signée attendue');
	}
	if (!verify(envelope)) throw new ApiError(400, 'Signature invalide');
	const clean: SignedEnvelope = {
		kind: envelope.kind,
		payload: envelope.payload,
		publicKey: envelope.publicKey,
		signature: envelope.signature
	};
	return {
		verified: {
			envelope: clean,
			publicKey: decodeKey(envelope.publicKey),
			payload: envelope.payload
		},
		body: body as Record<string, unknown>
	};
}
