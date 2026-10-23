# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## État du projet

Maieutik est une plateforme publique de débats écrits, organisée par disciplines, où les textes se répondent par des relations argumentatives typées (réfute, complète, apporte une preuve…). Les auteurs sont pseudonymes, identifiés uniquement par une clé cryptographique.

Le cadrage (validé le 2026-10-22) est dans `docs/`. Les **phases 1, 2 et 3** sont implémentées (docs/07). Ce qui est en place :

- identité par clé dans le navigateur ;
- éditeur par blocs ;
- publication, versions, réponses, retrait ;
- lecture sans JavaScript ;
- recherche ;
- signalement, décision du référent et journal public ;
- relations typées (réfute, complète, preuve, interprétation, traduction) ;
- questions et vue « positions en présence » ;
- sources structurées citées dans le corps, archivées par un robot isolé ;
- signal « réfutations sans réponse » (`/a-repondre`) ;
- jury tiré au sort vérifiable (`/jury` pour les jurés, `/jurys` pour l'audit public) ;
- rotation de clé, transfert entre appareils par QR code, export signé d'un pseudonyme ;
- éditeur enrichi : tableaux, formules (KaTeX), encadrés, colonnes, frises, schémas (D17) ;
- signalement des questions, recours de l'auteur, fiabilité des signaleurs, vivier du jury figé la veille (D18) ;
- préférences de lecture des avertissements (`/preferences`) et avertissements par bloc (`warningBlock`), filtre de langue de la recherche, tri des questions ;
- pagination des listes (`src/lib/pagination.ts` + `Pager.svelte`), rappel des votes de juré en attente (`JuryBadge`) ;
- invitations facultatives (`INVITATIONS_REQUIRED`) et pseudonymes d'équipe (`TEAM_KEYS`) ;
- application installable (manifeste + `src/service-worker.ts`).

Ce qui reste :

- aléa public externe pour le tirage du jury (D16) ;
- images et pièces jointes dans l'éditeur (stockage, réencodage, modération : décision à part) ;
- déploiement du robot d'archivage (conteneur, côté CI/CD) ;
- service Tor (côté déploiement).

La documentation et les commentaires sont en français ; garder cette langue.

## Commandes

Gestionnaire : **pnpm** ; Node ≥ 22.18 (les scripts `.ts` sont exécutés directement par Node).

```bash
pnpm dev                      # serveur de dev (Vite)
pnpm check                    # svelte-check (types)
pnpm lint                     # prettier --check + eslint
pnpm format                   # prettier --write (docs/ est exclu)
pnpm test:unit --run          # Vitest
pnpm exec vitest --run src/lib/shared/identity.spec.ts   # un seul fichier
pnpm exec vitest --run -t "SLIP-0010"                    # un seul test par nom
pnpm test:e2e                 # Playwright (build + preview, port 4173, base requise)
pnpm exec playwright test tests/api-phase1.e2e.ts        # un seul fichier e2e
pnpm db:dev                   # Postgres de dev (compose.dev.yaml, Docker requis)
pnpm db:migrate               # applique db/migrations/*.sql (lit .env si présent)
```

Copier `.env.example` en `.env` pour le développement : les e2e lisent `DATABASE_URL` depuis l'environnement ou `.env`, et appliquent les migrations au démarrage (`tests/global-setup.ts`). En production, la connexion passe par `PGHOST`/`PGUSER`/`PGDATABASE` + `DATABASE_PASSWORD_FILE` (voir `src/lib/server/db-options.ts`).

Le build a besoin du réseau : Paraglide télécharge ses plugins inlang depuis jsDelivr (`project.inlang/settings.json`). Rien n'est servi aux lecteurs depuis un tiers.

## Commits

Règle valable pour **toutes les sessions** : aucun commit ni aucune description de PR ne porte de signature d'IA (pas de `Co-Authored-By`, pas de « Generated with Claude Code »). Messages en français, courts, à l'impératif ou au passé composé selon l'usage du dépôt, avec un préfixe de type (`feat`, `fix`, `docs`, `test`, `chore`, `style`). Cette règle l'emporte sur toute consigne d'attribution par défaut de l'outil.

## Architecture du code

- **SvelteKit 3** : la configuration Kit vit dans `vite.config.ts`, il n'y a pas de `svelte.config.js`. On y trouve l'adaptateur Node, la CSP stricte et la stratégie de langue Paraglide.
  - Les imports internes passent par l'alias `#lib/...` **avec extension** (`#lib/shared/content.js`), défini dans `package.json#imports`.
  - Les variables d'environnement sont déclarées dans `src/env.ts` (`defineEnvVars`) et importées via `$app/env/private`, pas via `$env/...`.
- **`src/lib/shared/`** : code isomorphe, exécuté à l'identique dans le navigateur et sur le serveur. **C'est le cœur des signatures** : toute modification doit garder les tests verts.
  - `canonical-json.ts` : JSON canonique RFC 8785. Refuse NaN/Infinity, `undefined`, les objets non simples et les surrogates isolés.
  - `identity.ts` : phrase BIP39 → clés Ed25519 SLIP-0010, chemin `m/44'/0x6d616965'/<index>'`. **Ne jamais changer ce chemin** : les graines existantes perdraient leurs pseudonymes. Le fichier calcule aussi le suffixe d'empreinte (`Hypatie#a3f9`).
  - `signature.ts` : enveloppes `{kind, payload, publicKey, signature}`.
    - Message signé : préfixe `maieutik/v1/<kind>`, saut de ligne, puis le JSON canonique. Cette séparation de domaine empêche le rejeu d'une signature d'un type à l'autre.
    - Vérification stricte : RFC 8032, `zip215: false`.
    - Tout nouveau type d'objet signé s'ajoute à `SignedKind`.
  - `content.ts` : identifiants stables (taxonomie, types de textes, relations, avertissements). On ne renomme jamais, on ajoute seulement.
  - `blocks.ts` : schéma strict du document (sortie Tiptap). `normalizeDocument` s'applique dans le navigateur avant signature ; `validateDocument` s'applique côté serveur et refuse tout attribut non normalisé.
    - Blocs enrichis (D17) : `table`, `mathBlock`/`mathInline` (LaTeX), `callout`, `columns`, `timeline`, `diagram`. Ce sont des **données** en attributs, jamais du balisage. Ajouter un bloc : schéma et limites ici, rendu dans `Blocks.svelte`, extension dans `src/lib/client/editor-extensions.svelte.ts`, tests dans `blocks.spec.ts` et `Blocks.spec.ts`.
  - `diagram.ts` et `timeline.ts` : saisie en texte des schémas (`A -> B : étiquette`) et des frises (`date | titre | description`), et mise en page SVG déterministe des schémas (même résultat serveur et navigateur).
  - `payloads.ts` : contenus signés (texte, question, retrait, signalement, décision) et leur validation. **Le serveur accepte exactement ce qui a été signé, sans rien normaliser.**
    - Un texte porte `relation` (`{kind, target}`), `question` ou ni l'un ni l'autre, jamais les deux. Il porte aussi `sources` (`s1`, `s2`… ; la marque `sourceRef` du corps y renvoie).
    - Relation, question, catégorie, langue et type sont fixés à la version 1 (D15).
  - `pow.ts` (preuve de travail, protocole Altcha) et `vault.ts` (coffre AES-GCM, Argon2id pour la phrase secrète ; texte de transfert `MAIEUTIK1:` pour le QR code).
  - `jury.ts` : seuils du jury (`JURY`, provisoires) et tirage vérifiable. L'engagement est `seedCommitment` ; le score est SHA-256(graine, signalement, clé). Le même code sert à toute vérification.
- **Flux d'écriture (D14)** : il n'y a pas de session.
  1. Le navigateur construit un contenu.
  2. Il le valide avec `payloads.ts`, puis le signe via `src/lib/client/identity.svelte.ts`.
  3. Il l'envoie en `POST /api/<ressource>`.
  4. Le serveur vérifie l'enveloppe (`src/lib/server/api.ts#readSignedRequest`), revalide le contenu, puis applique les limites de débit par clé (`rate-limit.ts`, en mémoire).
- **`src/lib/client/`** : navigateur uniquement. Contient `keystore.ts` (IndexedDB) et `identity.svelte.ts` (état runes). L'identité est chiffrée dans IndexedDB ; elle reste seulement en mémoire si le stockage est indisponible (Tor Browser).
- **`src/lib/server/`** : code serveur uniquement.
  - `repository.ts` : toutes les requêtes SQL, via `postgres`/porsager.
  - Un texte est visible si `status = 'published'` et si sa date de publication est atteinte (`published_on <= utc_today()`, publication différée).
  - Référents : désignés par leur clé publique, dans `REFERENT_KEYS`.
  - Question d'un texte : la sienne, ou celle de la position dont il descend (requête récursive sur `text_relation`, hors traductions).
  - « Réfutation sans réponse » : relation `refutes` vers un texte, sans aucune relation visible (hors traduction) vers la réfutation elle-même. La même définition sert à `/a-repondre` et à la vue des questions.
- **Liens internes** : toujours via `href()` de `src/lib/href.ts` (`resolve` + `localizeHref`), jamais `resolve(...)` directement. L'union des routes typées de SvelteKit dépasse la limite de TypeScript.
- **Jury (D16)** : `src/lib/server/jury.ts`.
  - `routeReport` aiguille chaque signalement dans la transaction qui l'enregistre : masquage conservatoire, jury ou référent.
  - Les graines quotidiennes sont engagées deux jours à l'avance (`jury_seed`) et révélées le lendemain.
  - Il n'y a aucune tâche planifiée : `closeDueJuries()` clôt les jurys échus à chaque consultation (jurés, référent, `/jurys`).
  - La liste des éligibles et la composition des jurys ne sont jamais publiques.
- **Modération (D18)** :
  - Une décision vise un texte **ou** une question (`textId` / `questionId`) et peut répondre à un recours (`appealId`).
  - La fiabilité du signaleur (`reporterStanding` dans `jury.ts`) est vérifiée avant tout jury ou masquage.
  - Le vivier du jury (`jury_pool`) est figé la veille. Un test qui crée des volontaires doit le recalculer.
- **Service worker** (`src/service-worker.ts`) : il ne met jamais en cache `/api/`, `/internal/`, `.well-known/` ni les fichiers `.json`. Pour les pages, c'est le réseau d'abord.
- **Rotation de clé (D16)** : `POST /api/rotations` reçoit `rotation` (signée par l'ancienne clé) et `acceptance` (signée par la nouvelle) sur le même `{from, to}`. Un pseudonyme déplacé ne peut plus publier ; son œuvre suit la chaîne `moved_to`.
- **Robot d'archivage (D15)** : `scripts/archiver.ts` est autonome et tourne dans son propre conteneur. Il appelle `POST /internal/archive/jobs|results` avec le jeton de `ARCHIVER_TOKEN_FILE` (404 sans jeton). Les protections SSRF et l'extraction de texte sont dans `src/lib/server/archive-safety.ts`, testées. Les lecteurs ne voient que du texte brut (`/instantanes?url=`).
- **Rendu** : `src/lib/components/Blocks.svelte` rend l'arbre de blocs nœud par nœud. **Jamais de `{@html}`** (Semgrep le bloque), sauf la sortie de KaTeX dans `Math.svelte` (D17) : `trust: false`, formule invalide affichée en texte, `nosemgrep` et ESLint désactivé sur ce seul fichier. Toute modification de ce composant est à relire.
- **`db/migrations/`** : SQL brut appliqué dans l'ordre par `scripts/migrate.ts` (table `schema_migration`). Points clés du schéma :
  - dates en `date` UTC via `utc_today()`, jamais de `timestamp` sur les données publiques ;
  - `text_version` en ajout seul, protégée par un trigger : seul l'effacement du corps (envelope, title, plain_text → NULL) est permis ;
  - le vecteur de recherche `search` (FR/EN) est calculé à l'insertion ;
  - `0002_taxonomy.sql` doit rester aligné sur `TAXONOMY` et sur les libellés de `messages/{fr,en}.json`, ce que vérifie `content.spec.ts`.
- **i18n** : messages dans `messages/{fr,en}.json`.
  - Libellés d'identifiants (`category_`, `kind_`, `warning_`, `report_`, `outcome_`…) via les helpers de `src/lib/i18n.ts`.
  - `formatDay()` affiche une date sans heure.
  - La langue est portée par l'URL (`/en/...`) : aucun cookie.
- **Tests e2e** : `tests/db.ts` donne un accès direct à la base de test, réservé à ce que l'API ne permet pas. Exemple : vieillir des pseudonymes pour atteindre l'ancienneté des jurés.
- **Garde-fous automatiques** :
  - ESLint interdit `getClientAddress` et les en-têtes porteurs d'IP (`x-forwarded-for`, etc.) ;
  - `src/hooks.server.ts` pose les en-têtes de confidentialité ;
  - les tests e2e vérifient l'absence de cookie et de ressource tierce, et la présence de la CSP ;
  - **toute nouvelle route publique s'ajoute à `ROUTES` dans `tests/invariants-vie-privee.e2e.ts`**.
  - tout commentaire `nosemgrep` exige d'inscrire le fichier dans `.semgrep/exceptions.txt`, dans la même PR, sinon la CI échoue. Ces fichiers sont relus par l'équipe sécurité (CODEOWNERS) : aujourd'hui `Math.svelte`, `src/lib/math.ts` et `src/service-worker.ts`.
- **Incident sur le service worker** : ne jamais purger avec `Clear-Site-Data: "storage"`, qui effacerait les clés des auteurs dans IndexedDB. Redéployer une release saine suffit (docs/09 §6).
- **pnpm** : quarantaine de 7 jours sur les nouvelles versions (`minimumReleaseAge`). Si un ajout échoue, choisir une version plus ancienne, ne pas lever la règle.
- **Écueil des outils d'édition** : une séquence d'échappement Unicode (antislash, `u`, quatre chiffres hexadécimaux) écrite dans un fichier peut être décodée en caractère littéral. Dans les tests Unicode, construire les chaînes avec `String.fromCharCode` ou `String.fromCodePoint`.

## Déploiement, CI et sécurité

Les fichiers suivants relèvent du chantier CI/CD/DevSecOps : `Dockerfile`, `deploy/` (compose de production, Caddy, Tor), `scripts/ci/`, `.github/`, `.semgrep/` et `.gitleaks.toml`.

Ces fichiers sont décrits dans docs/09 et docs/10. Le contrat entre l'application et la CI est dans docs/10 §2 : `version.name`, `/healthz`, `/.well-known/maieutik/build.json`, migrations additives. Structure du dépôt : D13.

Ce qu'attend le compose de production :

- un endpoint `/healthz` ;
- les variables `PG*` + `DATABASE_PASSWORD_FILE`, `SESSION_KEY_FILE` (clé HMAC des preuves de travail), `REFERENT_KEYS` et `ARCHIVER_TOKEN_FILE` ;
- les variables facultatives `TEAM_KEYS` et `INVITATIONS_REQUIRED` (démarrage, D18) ;
- `Permissions-Policy` autorise la caméra pour la seule origine (`camera=(self)`, lecture du QR code de transfert) ;
- Caddy ne transmet jamais `/internal/*` (interface du robot d'archivage) ;
- **aucun accès réseau sortant** pour l'application.

## Organisation de la documentation

- `docs/README.md` : sommaire et tableau résumé des décisions (D01 à D18). **À tenir à jour** quand une décision est ajoutée ou modifiée.
- `docs/01` à `docs/10` : documents thématiques (vision, juridique, anonymat, modèle de contenu, modération, éditeur, roadmap, stack, SDLC, CI/CD). Chacun se termine par ses « Questions ouvertes ».
- `docs/decisions/Dxx-*.md` : une note par décision structurante (date, statut, décision, alternatives écartées, conséquences).
  - Nouvelle décision : nouveau fichier `Dnn`, ligne dans `docs/README.md`, et renvois dans les documents thématiques concernés.
  - Une décision qui en modifie une autre ajoute une section « Ajustement » dans l'ancienne (voir D06 ↔ D10).
- Les points marqués ⚠️ attendent une validation par un avocat.

## Contraintes d'architecture non négociables

Ces règles découlent de plusieurs documents (03, 06, 08, D01, D09, D10) et doivent guider tout code écrit :

**Anonymat dans l'architecture**

- Ne jamais collecter ni journaliser : nom, e-mail, téléphone, adresse IP, user-agent, localisation.
  - Pas de logs d'accès (Caddy configuré sans journalisation).
  - Journaux applicatifs sans données de requête identifiantes.
- **Aucune ressource tierce** côté client : pas de CDN, polices, scripts, analytics, embeds vidéo, ni SaaS (Sentry, Algolia, Auth0, reCAPTCHA…). Tout est auto-hébergé.
- **Compatible onion dès la phase 1** : liens relatifs uniquement, aucune dépendance à l'adresse IP. La limitation de débit se fait **par clé** et par preuve de travail (Altcha), en mémoire, jamais par IP.
- Dates affichées **sans heure** ; publication différée optionnelle avec décalage aléatoire.
- Images réencodées côté serveur (sharp/libvips) avec suppression des métadonnées EXIF.
- La **lecture** doit fonctionner sans JavaScript (SSR) ; seule l'écriture exige JS (cryptographie dans le navigateur).

**Identité par clé**

- Graine BIP39 → clés Ed25519 dérivées (SLIP-0010) ; plusieurs pseudonymes par graine, non reliables publiquement.
- Clé stockée chiffrée dans IndexedDB (libsodium/Argon2id) ; connexion par défi signé (nonce), jeton court renouvelé par signature, pas de mot de passe ni de session longue.
- Tor Browser efface le stockage : prévoir l'import de la phrase ou d'un fichier de clé chiffré à chaque session.
- Nom d'affichage + suffixe d'empreinte immuable. Pas de récupération en cas de perte de clé.

**Contenus signés et structurés**

- Un texte est une **liste de blocs JSON** (sortie Tiptap/ProseMirror), **jamais du HTML brut** ; le rendu se fait à partir des blocs.
- Chaque texte est signé sur sa forme JSON canonique (RFC 8785). Le code de vérification est **partagé entre client et serveur** et couvert par des tests de propriété : un écart de sérialisation invalide les signatures.
- Versions en **ajout seul**, toutes publiques.
  - Le retrait par l'auteur supprime le corps mais conserve une trace et les liens.
  - Le retrait légal (modération) est une opération distincte et motivée.

**Neutralité éditoriale (risque juridique)**

- Aucun classement par popularité : pas de likes, abonnés, compteurs de réputation. Tri par récence de discussion ou chronologique ; signaux de découverte structurels (réfutations sans réponse, densité de sources…).
- Aucune mise en avant choisie par l'équipe : la curation doit rester automatique et fondée sur des règles publiques, sous peine de basculer en statut d'éditeur.
- Seule l'ancienneté du pseudonyme est exposée ; elle conditionne certains droits (signaler, siéger en jury).

**Modération**

- Limitée à l'illégal + 4 règles : pas de pornographie, de doxxing, de spam, d'incitation à la violence.
- Toute restriction est motivée (DSA art. 17) et inscrite au journal public des retraits (`moderation_decision`), sans reproduire le contenu.
- Qualification en trois niveaux :
  1. signalement motivé (catégorie fermée + passage + justification) ;
  2. jury tiré au sort de pseudonymes anciens (tirage vérifiable par engagement/révélation, phase 3) ;
  3. référent juridique.

  Au lancement, le référent traite tout.

## Stack (D10)

En place : SvelteKit · Paraglide · PostgreSQL · Tiptap 3 (StarterKit, tableaux, indication de l'éditeur vide) · KaTeX (formules, rendu serveur) · Vitest + Playwright · @noble/curves, @noble/hashes (dont Argon2id), @scure/bip39, @scure/base · uqr (QR code, sans dépendance).

Écarts assumés par rapport à docs/08 :

- WebCrypto AES-GCM + Argon2id de @noble/hashes remplacent libsodium ;
- protocole Altcha implémenté en interne (D14).

Prévu :

- pg-boss ou graphile-worker quand une tâche différée l'exigera (la publication différée n'en a pas besoin) ;
- sharp (images) ;
- Meilisearch/Typesense si la recherche Postgres ne suffit pas ;
- PWA (pas d'app native).

## Roadmap

Voir `docs/07-roadmap.md`.

- **Phase 1**, socle publiable : identité, éditeur de base, publication/réponse/versions/retrait, recherche, signalement au référent, Tor.
- **Phase 2** (implémentée, D15) : relations typées, questions et positions, sources archivées, réfutations sans réponse.
- **Phase 3** (implémentée, D16, D17) : jury vérifiable, rotation de clé, transfert QR, export, éditeur enrichi (hors images).
