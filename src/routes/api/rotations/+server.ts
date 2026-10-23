import { json } from '@sveltejs/kit';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { rotateKey } from '#lib/server/repository.js';
import { canonicalize } from '#lib/shared/canonical-json.js';
import { validateRotation } from '#lib/shared/payloads.js';
import { decodeKey, verify, type SignedEnvelope } from '#lib/shared/signature.js';
import type { RequestHandler } from './$types';

/**
 * Rotation de clé (docs/03) : `rotation` signée par l'ancienne clé, `acceptance` signée
 * par la nouvelle, sur le même contenu `{from, to}`.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified, body } = await readSignedRequest(request, 'key-rotation', 'rotation');
		const payload = validateRotation(verified.payload);
		if (!payload.ok) throw new ApiError(400, payload.error);
		if (payload.value.from !== verified.envelope.publicKey) {
			throw new ApiError(400, 'La rotation doit être signée par l’ancienne clé');
		}

		const acceptance = body.acceptance as SignedEnvelope | undefined;
		if (
			!acceptance ||
			acceptance.kind !== 'key-rotation-accept' ||
			acceptance.publicKey !== payload.value.to ||
			!verify(acceptance) ||
			canonicalize(acceptance.payload) !== canonicalize(payload.value)
		) {
			throw new ApiError(400, 'Acceptation de la nouvelle clé absente ou invalide');
		}

		await rotateKey(verified.publicKey, decodeKey(payload.value.to), verified.envelope, {
			kind: acceptance.kind,
			payload: acceptance.payload,
			publicKey: acceptance.publicKey,
			signature: acceptance.signature
		});
		return json({ status: 'moved' });
	} catch (error) {
		return errorResponse(error);
	}
};
