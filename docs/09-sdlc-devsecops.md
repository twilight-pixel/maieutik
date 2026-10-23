# 09. Cycle de développement sécurisé (DevSecOps)

> Statut : proposé le 2026-10-22. Pipeline : [10-ci-cd.md](10-ci-cd.md). Décisions : [D11](decisions/D11-forge-et-integration-continue.md), [D12](decisions/D12-integrite-du-code-servi.md).

## 1. Pourquoi c'est critique ici

La clé d'un auteur vit dans son navigateur (D01, D06). **Tout JavaScript servi par le site peut la lire.** Une dépendance piégée, une action CI compromise, un commit malveillant ou un serveur compromis suffisent à voler les clés de tous les auteurs qui se connectent, sans trace côté serveur puisqu'il n'y a pas de journal.

Le cycle de développement protège donc, par ordre de priorité :

1. **L'intégrité du code servi aux navigateurs** (D12).
2. **Les invariants de vie privée** : pas d'IP, pas de tiers, pas d'heure. Ils sont invisibles à l'usage : une régression passe inaperçue sans contrôle dédié (§3).
3. **Les défauts classiques** (XSS, injection, dépendances vulnérables), aggravés ici : une XSS équivaut à un vol de clé.

## 2. Menaces sur la chaîne de développement

| Menace                                    | Exemple                                                    | Réponse principale                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Dépendance npm piégée                     | Version malveillante publiée depuis un compte volé         | Lockfile figé, quarantaine de 7 jours, scripts d'installation bloqués, revue de chaque ajout, OSV    |
| Action CI compromise                      | Tag réécrit vers du code malveillant (tj-actions, 2025)    | Actions épinglées par SHA, très peu d'actions tierces, outils en images épinglées par digest, zizmor |
| Commit malveillant ou compte compromis    | PR qui envoie la graine vers un serveur                    | Relecture obligatoire de l'équipe sécurité (CODEOWNERS), commits signés, clés matérielles            |
| Fuite de secret                           | Clé onion ou clé de sauvegarde poussée dans le dépôt       | gitleaks avant commit et en CI ; aucun secret hors du serveur                                        |
| Régression de vie privée                  | Police Google, journal de `x-forwarded-for`, heure affichée | Invariants testés automatiquement (§3)                                                              |
| Serveur compromis servant un JS modifié   | Script qui exfiltre les clés à la connexion                | Manifeste signé, vérification externe horaire (D12)                                                  |
| Requête forgée par le robot d'archivage (SSRF) | Source dont le DNS pointe vers 169.254.169.254 ou Postgres | Filtrage des adresses à la résolution (D15) ; robot sans accès à Postgres ni aux autres conteneurs, sortie IPv4 seule |
| Build non reproductible                   | Impossible de prouver que le code servi est le code publié | Double build comparé à chaque PR (D12)                                                               |
| Image de base vulnérable                  | Faille dans la libc de l'image                             | Image distroless, Trivy à chaque PR et chaque nuit                                                   |
| Désanonymisation d'un opérateur (D02)     | Fuseau horaire des commits, e-mail du compte ACME          | Hygiène des opérateurs (§8)                                                                          |

## 3. Invariants de vie privée et de sécurité

Chaque invariant a au moins un contrôle automatique. **Un invariant sans contrôle n'est qu'un souhait** : en ajouter un, c'est ajouter une ligne ici et le contrôle correspondant.

| #   | Invariant                                                        | Contrôles                                                                                                       |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| I1  | L'application ne lit jamais l'adresse IP du client               | ESLint (`no-restricted-*`), Semgrep `maieutik-no-client-address` et `-no-address-header-config`, canari CI       |
| I2  | Aucun journal d'accès ou d'erreur contenant une IP               | `check-caddy-config.mjs`, Postgres sans `log_connections`, canari à travers Caddy (job `image`)                 |
| I3  | Aucune ressource d'une autre origine ; liens relatifs (onion)    | CSP, `check-external-resources.mjs` (build et HTML servi), test réseau Playwright, Semgrep `no-external-*`       |
| I4  | Aucun HTML brut : rendu à partir des blocs                       | Semgrep `no-raw-html-*` et `no-dynamic-code`, CSP sans `unsafe-eval`                                            |
| I5  | Aucune heure exposée, seulement des dates (D09)                  | Semgrep `no-time-display`, Playwright « aucune heure exposée »                                                  |
| I6  | Lecture possible sans JavaScript                                 | Playwright « lisible sans JavaScript »                                                                          |
| I7  | Aucun cookie déposé chez un lecteur                              | Playwright                                                                                                      |
| I8  | En-têtes de sécurité (CSP, no-referrer, nosniff, frame-ancestors) ; `Permissions-Policy` : caméra pour la seule origine (QR de transfert, D16), micro et géolocalisation interdits | Playwright, ZAP |
| I9  | Aléa cryptographique uniquement (délai D09, nonces, tirages)     | Semgrep `no-math-random`                                                                                        |
| I10 | Primitives cryptographiques seulement dans `src/lib/shared`      | Semgrep `crypto-boundary`, CODEOWNERS                                                                           |
| I11 | Journaux et base sans données de requête                         | Semgrep `no-request-logging` ; canari : un User-Agent et une IP témoins ne doivent apparaître ni dans les journaux ni dans `pg_dump` |
| I12 | Images publiées sans métadonnées                                 | **À écrire** avec le module d'images : test sur un JPEG portant des coordonnées GPS                             |
| I13 | L'application n'a aucun accès réseau sortant ; seul le robot d'archivage sort, sans voir les autres services | Réseaux Docker `internal` ([deploy/compose.yaml](../deploy/compose.yaml))                  |
| I14 | L'interface `/internal/*` du robot n'est jamais exposée          | `check-caddy-config.mjs` (règle 5) ; job `image` : 404 par Caddy, en clearnet et en onion, même avec le bon jeton |

Les règles Semgrep sont dans [.semgrep/maieutik.yml](../.semgrep/maieutik.yml), avec leurs cas de test. Une exception se déclare par `// nosemgrep: <id>` suivi de sa justification, et le fichier s'inscrit dans [.semgrep/exceptions.txt](../.semgrep/exceptions.txt), relu par l'équipe sécurité. La CI échoue si un `nosemgrep` apparaît ailleurs. Seule exception à ce jour : la sortie de KaTeX dans `Math.svelte` (D17).

## 4. Règles de développement

### Code

- La cryptographie, la canonicalisation (RFC 8785) et la vérification des signatures vivent dans `src/lib/shared` et nulle part ailleurs. Vecteurs de test fixes et **tests de propriété** (fast-check) : client et serveur doivent produire la même sérialisation pour toute entrée.
- Le rendu des blocs valide strictement leur schéma : un type ou un attribut inconnu est rejeté, jamais rendu « au mieux ».
- Pas de `{@html}`. Seule exception prévue : la sortie KaTeX, dans un composant dédié.

### Dépendances

Les dépendances côté client sont les plus dangereuses : elles s'exécutent là où vit la clé.

- Lockfile versionné, `--frozen-lockfile` partout.
- **Quarantaine de 7 jours** avant d'adopter une version publiée (`minimumReleaseAge` de pnpm, `cooldown` de Dependabot). Les mises à jour de sécurité n'attendent pas.
- Scripts d'installation bloqués par pnpm, sauf liste blanche (`onlyBuiltDependencies`) relue à chaque ajout.
- Avant d'ajouter une dépendance : est-elle nécessaire ? maintenue ? combien de dépendances transitives ? a-t-elle des scripts d'installation ? une provenance npm ? La PR répond à ces questions.

### Secrets

- Aucun secret dans le dépôt ni dans la CI. Sur le serveur seulement : `/etc/maieutik/secrets` (mode 0400).
- La clé privée des sauvegardes (age) n'est **jamais** sur le serveur : hors ligne, en deux exemplaires détenus par deux opérateurs.
- gitleaks tourne avant chaque commit (poste du développeur) et sur tout l'historique en CI.

## 5. Revue et intégration

- `main` est protégée : PR obligatoire, CI verte, historique linéaire, aucun push forcé, commits signés (clés SSH, idéalement matérielles `ed25519-sk`).
- Une approbation suffit en général. Les zones sensibles (crypto, en-têtes, dépendances, pipeline, déploiement, migrations) exigent celle de l'équipe sécurité ([CODEOWNERS](../.github/CODEOWNERS)) : au moins deux personnes ont lu chaque ligne.
- **Règle des deux personnes pour la production** : un mainteneur crée le tag, un autre approuve l'environnement `release`.
- Le modèle de PR ([.github/pull_request_template.md](../.github/pull_request_template.md)) reprend les invariants.

### Fiche de menaces

Toute fonctionnalité qui touche l'identité, la cryptographie, la modération ou un flux réseau sortant (archivage des sources, phase 2) a sa fiche dans `docs/menaces/AAAA-MM-<sujet>.md`, relue avant le code :

```markdown
# Fiche de menaces : <fonctionnalité>

## Actifs et flux

Ce qui est manipulé (clé, texte, signalement...), d'où à où.

## Sécurité (STRIDE)

Usurpation, altération, répudiation, divulgation, déni de service, élévation : ce qui s'applique.

## Vie privée (LINDDUN)

Liaison de deux pseudonymes, identification, détectabilité d'une action, divulgation,
méconnaissance par l'utilisateur.

## Mesures et tests

Chaque mesure renvoie au test ou à l'invariant qui la vérifie.
```

## 6. Exploitation et réponse

### Délais de correction

| Gravité  | Exemples                                                     | Délai                   |
| -------- | ------------------------------------------------------------ | ----------------------- |
| Critique | Vol de clé, désanonymisation, exécution de code sur le serveur | 48 heures             |
| Haute    | XSS sans accès à la clé, contournement de la modération      | 7 jours                 |
| Moyenne  | Fuite d'information limitée, déni de service applicatif      | 30 jours                |
| Basse    | Durcissement                                                 | Version suivante        |

### Surveillance

- Chaque heure : le code servi (clearnet et onion) est comparé au manifeste signé de la release annoncée (D12).
- Chaque nuit : nouvelles vulnérabilités sur le lockfile (OSV) et sur l'image en production (Trivy).
- Chaque semaine : OpenSSF Scorecard.
- Sauvegardes `pg_dump` chiffrées avec age ; **restauration testée chaque mois** sur une machine jetable.

### Incident « code servi compromis »

C'est le pire scénario : il touche les clés des auteurs.

1. Remplacer le site par une page statique d'alerte.
2. Publier un avis signé (même identité Sigstore que les releases).
3. Délimiter la fenêtre d'exposition grâce à l'historique de la vérification horaire.
4. Les auteurs connectés pendant cette fenêtre doivent considérer leur clé comme compromise et la **faire tourner**.
5. Service worker : un script piégé installé pendant la fenêtre reste dans les navigateurs. Le navigateur revérifie le script du service worker à chaque navigation, hors de son contrôle. Redéployer une release saine le remplace donc dès la visite suivante. Ne pas envoyer `Clear-Site-Data: "storage"` : il effacerait aussi les clés des auteurs (IndexedDB).

⚠️ La déclaration de rotation de clé est prévue en phase 3 (docs/07). Sans elle, l'étape 4 n'a pas de remède. **Proposition : avancer au moins son format et sa vérification en phase 1.**

## 7. Mesure de la maturité

| Indicateur                                             | Cible                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| OpenSSF Scorecard                                      | ≥ 8/10                                                         |
| SLSA (intégrité du build)                              | Niveau 2 au lancement (provenance signée), niveau 3 visé       |
| Durée de la CI d'une PR                                | < 15 minutes                                                   |
| Vulnérabilités hautes ou critiques au-delà de leur délai | 0                                                            |
| Releases dont le code servi a été vérifié              | 100 %                                                          |

## 8. Hygiène des opérateurs

Le risque juridique lié aux opérateurs est accepté pour l'instant (D02) ; inutile de l'aggraver par des fuites évitables.

- Comptes de forge, de registre et d'hébergement pseudonymes, e-mail `noreply`, clés matérielles FIDO2.
- **Fuseau horaire des commits** : git enregistre le décalage local (`+0200`). Travailler avec `TZ=UTC`. Les heures de commit restent visibles : c'est l'équivalent, pour les opérateurs, du recoupement que D09 évite aux auteurs.
- Aucun e-mail sur le compte ACME de Caddy (contrôlé par `check-caddy-config.mjs`).
- Sur le serveur : pas de règle de pare-feu qui journalise les paquets, journald en mémoire seulement (`Storage=volatile`), accès SSH par clé matérielle uniquement.

## Questions ouvertes

- Forge définitive et organisation pseudonyme (D11).
- Canal de signalement chiffré et joignable par Tor ([SECURITY.md](../SECURITY.md)).
- Avancer la déclaration de rotation de clé en phase 1 (§6).
- Isolement de la clé : origine dédiée, clés WebCrypto non extractibles (D12).
- Tests de mutation (Stryker) sur `src/lib/shared` : seuil à fixer.
- Audit externe de la cryptographie avant lancement : budget à trouver (D08).
