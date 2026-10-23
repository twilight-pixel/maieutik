import { REFERENT_KEYS } from '$app/env/private';
import { ApiError, type VerifiedEnvelope } from './api';

/** Seules les clés listées dans REFERENT_KEYS peuvent décider (référent juridique, docs/05). */
export function isReferent(publicKey: string): boolean {
	return REFERENT_KEYS.includes(publicKey);
}

export function requireReferent(verified: VerifiedEnvelope): void {
	if (!isReferent(verified.envelope.publicKey)) {
		throw new ApiError(403, 'Réservé au référent juridique');
	}
}

/** Accès signé du référent : horodatage récent, pour éviter le rejeu d'une requête interceptée. */
export function requireFreshAccess(payload: unknown, now = Date.now()): void {
	const requestedAt = (payload as { requestedAt?: unknown } | null)?.requestedAt;
	if (typeof requestedAt !== 'number' || Math.abs(now - requestedAt) > 5 * 60_000) {
		throw new ApiError(400, 'Demande expirée : vérifiez l’horloge de votre appareil');
	}
}
