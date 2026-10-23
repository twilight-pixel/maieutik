import { getJuryAudit } from '#lib/server/jury.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => getJuryAudit();
