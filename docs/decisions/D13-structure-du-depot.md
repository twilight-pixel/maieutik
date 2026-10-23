# D13. Structure du dépôt : une application à la racine, un noyau isolé

- **Date :** 2026-10-22
- **Statut :** validé

## Question

Faut-il démarrer en monorepo (`apps/web`, `packages/core`, `packages/db`) ou avec une seule application SvelteKit à la racine ?

## Décision

**Une seule application à la racine**, avec deux frontières internes vérifiées automatiquement :

| Dossier | Contenu | Frontière |
|---|---|---|
| `src/lib/shared/` | Noyau isomorphe : JSON canonique, identité, signatures, modèle de contenu | ESLint : aucun import de `$app`, `$env`, `node:`, `svelte`, ni hors du dossier. Semgrep : seul endroit autorisé à importer `@noble`, `@scure`, `libsodium`. |
| `src/lib/server/` + `db/` + `scripts/migrate.ts` | Accès à la base, migrations | Code serveur uniquement (`$lib/server` est refusé côté client par SvelteKit). |

## Raisons

- **Un seul livrable** : un serveur, une image (D10). Un monorepo ajoute de la configuration (workspaces, résolution des paquets TypeScript, `pnpm deploy`) sans second consommateur à servir.
- **Node n'exécute pas le TypeScript situé dans `node_modules`** : un paquet `packages/db` en TypeScript ne pourrait pas être lancé directement dans l'image comme l'est aujourd'hui `scripts/migrate.ts` ; il faudrait une étape de compilation.
- **La chaîne CI/CD est construite et validée sur cette structure** (docs/10) : build reproductible, manifeste, image distroless.
- **Le noyau reste extractible** : comme `src/lib/shared/` n'a aucune dépendance au framework, on peut le déplacer en paquet sans le réécrire.

## Alternative écartée

Monorepo dès le départ : frontières plus explicites et paquet `core` publiable, au prix d'une complexité de build immédiate pour un besoin futur.

## Conditions de révision

Passer en workspace pnpm (`packages/core` extrait de `src/lib/shared/`) dès qu'apparaît un **second consommateur du noyau**, par exemple :

- un outil public de vérification des signatures ou des exports ;
- une extension de navigateur ;
- un processus de tâches séparé de l'application ;
- une fédération.
