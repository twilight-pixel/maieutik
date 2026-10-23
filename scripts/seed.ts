/**
 * Données de test pour le développement : pseudonymes, questions et textes qui se répondent,
 * dans l'esprit maïeutique (questionner, objecter, faire préciser).
 *
 * Usage : pnpm db:seed   (serveur de dev lancé ; APP_URL=http://localhost:5173 par défaut)
 *
 * Le contenu est signé comme le ferait le navigateur, puis envoyé par l'API publique : tout
 * passe par la validation et les limites du serveur. Les clés et les identifiants sont
 * dérivés de libellés fixes, donc relancer le script ne duplique rien (409 ignorés).
 *
 * Le code partagé s'importe sans extension : Node ne sait pas le charger seul, on passe par
 * le chargeur de Vite.
 */
import { runnerImport } from 'vite';

const { module } = await runnerImport<typeof import('./seed-data.ts')>('./scripts/seed-data.ts', {
	configFile: false,
	logLevel: 'error'
});
await module.seed(process.env.APP_URL ?? 'http://localhost:5173');
