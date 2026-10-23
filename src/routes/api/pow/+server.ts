import { json } from '@sveltejs/kit';
import { createChallenge } from '#lib/shared/pow.js';
import { powKey } from '#lib/server/secrets.js';
import type { RequestHandler } from './$types';

/** Difficulté : 150 000 hachages en moyenne, quelques secondes au plus dans un navigateur. */
const POW = { maxNumber: 300_000, ttlSeconds: 600 };

export const GET: RequestHandler = () =>
	json(createChallenge(powKey, POW), { headers: { 'cache-control': 'no-store' } });
