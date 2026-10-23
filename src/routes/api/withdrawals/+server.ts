import { json } from '@sveltejs/kit';
import { ApiError, errorResponse, readSignedRequest } from '#lib/server/api.js';
import { limits } from '#lib/server/rate-limit.js';
import { withdrawText } from '#lib/server/repository.js';
import { validateWithdrawal } from '#lib/shared/payloads.js';
import type { RequestHandler } from './$types';

/** Retrait par l'auteur : le corps disparaît, une trace reste (D05). */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { verified } = await readSignedRequest(request, 'text-withdrawal');
		const payload = validateWithdrawal(verified.payload);
		if (!payload.ok) throw new ApiError(400, payload.error);
		if (!limits.withdrawals.take(verified.envelope.publicKey)) {
			throw new ApiError(429, 'Trop de demandes : réessayez plus tard');
		}
		await withdrawText(verified.publicKey, payload.value.textId, verified.envelope);
		return json({ status: 'withdrawn' });
	} catch (error) {
		return errorResponse(error);
	}
};
