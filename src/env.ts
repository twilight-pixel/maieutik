import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
	DATABASE_URL: {
		description:
			'Connexion PostgreSQL en développement. En production, utiliser PGHOST/PGUSER/PGDATABASE et DATABASE_PASSWORD_FILE.',
		schema: optional
	},
	DATABASE_PASSWORD_FILE: {
		description: 'Fichier contenant le mot de passe Postgres (secret Docker).',
		schema: optional
	},
	SESSION_KEY_FILE: {
		description:
			'Fichier contenant la clé HMAC des preuves de travail (secret Docker). Absent : clé aléatoire par processus.',
		schema: optional
	},
	ARCHIVER_TOKEN_FILE: {
		description:
			'Fichier contenant le jeton partagé avec le robot d’archivage des sources (secret Docker). Absent : interface interne désactivée.',
		schema: optional
	},
	TEAM_KEYS: {
		description:
			'Clés publiques (base64url, séparées par des virgules) des pseudonymes d’équipe, affichés comme tels (docs/07, démarrage à froid).',
		schema: (value) =>
			(value ?? '')
				.split(',')
				.map((key) => key.trim())
				.filter(Boolean)
	},
	INVITATIONS_REQUIRED: {
		description:
			'« true » pour exiger un code d’invitation à la création d’un pseudonyme (démarrage, docs/07).',
		schema: (value) => value === 'true'
	},
	REFERENT_KEYS: {
		description:
			'Clés publiques (base64url, séparées par des virgules) des référents juridiques habilités à décider (docs/05).',
		schema: (value) =>
			(value ?? '')
				.split(',')
				.map((key) => key.trim())
				.filter(Boolean)
	}
});
