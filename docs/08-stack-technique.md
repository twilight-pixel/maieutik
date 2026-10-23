# 08. Stack technique

> Statut : validé le 2026-10-22 (voir [D10](decisions/D10-stack-technique.md)).

## Contraintes qui guident les choix

- **Aucun service tiers** : ni CDN grand public, ni analytics, ni polices ou scripts externes, ni SaaS d'erreurs. Chacun verrait l'IP des lecteurs.
- **Cryptographie côté navigateur** : génération de clé, signature des textes.
- **Contenus signés et structurés** : le même code de vérification tourne côté client et côté serveur.
- **Équipe réduite, budget de dons** : peu de composants à exploiter.

## Choix par couche

| Couche | Choix | Raison | Alternative |
|---|---|---|---|
| Langage | **TypeScript** de bout en bout | Code de vérification des signatures partagé entre client et serveur | Go pour le serveur |
| Web et serveur | **SvelteKit** (rendu côté serveur, adaptateur Node) | Pages légères, lisibles sans JavaScript ; seule l'écriture exige JS | Next.js |
| Éditeur par blocs | **Tiptap** (ProseMirror) | Sortie en JSON structuré, blocs personnalisables, KaTeX pour les formules | Lexical |
| Cryptographie | **@noble/curves** (Ed25519), **@scure/bip39** (graine), **libsodium** (Argon2id, chiffrement local) | Bibliothèques auditées et minimales ; dérivation de plusieurs pseudonymes depuis une graine | WebCrypto Ed25519 |
| Sérialisation signée | **JSON canonique (RFC 8785)** | Une signature n'est stable que si la sérialisation l'est ; tests de propriété | CBOR déterministe |
| Base de données | **PostgreSQL** | Graphe de textes et de relations, versions en ajout seul, recherche plein texte FR / EN | – |
| Recherche | **Postgres FTS**, puis **Meilisearch** ou **Typesense** si besoin | Un composant de moins au lancement | – |
| Tâches différées | **pg-boss** ou **graphile-worker** | Publication différée, tirage du jury, archivage ; pas de Redis | – |
| Fichiers et images | Disque local ou stockage compatible S3 + **sharp / libvips** | Réencodage, suppression des métadonnées | – |
| Anti-abus | **Altcha** (preuve de travail auto-hébergée) + limites de débit en mémoire, par clé | Pas de CAPTCHA tiers | mCaptcha |
| Serveur frontal | **Caddy**, journaux d'accès désactivés | TLS automatique, configuration courte | nginx |
| Déploiement | **Docker Compose** sur **un seul serveur** (Postgres sur la même machine) | Peu de pièces au lancement | Ansible plus tard |
| Interface multilingue | **Paraglide** ou fichiers JSON typés | FR / EN, taxonomie à libellés traduits | – |
| Mobile | **PWA** | Pas d'application native : les magasins exigent des comptes identifiés | – |
| Tests | **Vitest** + **Playwright** | Signatures, scénarios de bout en bout | – |
| CI/CD et contrôles | **GitHub Actions**, Semgrep, gitleaks, Trivy, Sigstore | Invariants de vie privée testés, releases signées (voir 09, 10, D11, D12) | Forgejo Actions |

## Hébergement

- Hébergeur en **Suisse ou Islande** dont les conditions acceptent ce service. À évaluer : Infomaniak, 1984 Hosting, FlokiNET. À lire attentivement et à valider avec l'avocat (voir 02).
- **Pas de CDN grand public** : il termine le TLS et voit les adresses IP, ce qui contredit « sans journal ». Protection anti-DDoS de l'hébergeur et limites de débit à la place.
- **Sauvegardes** `pg_dump` chiffrées, hors site.

## Service Tor onion dès le lancement (D10)

- Un démon Tor devant la même application.
- Contraintes à respecter **dès la phase 1** : liens relatifs uniquement, aucune ressource externe, aucune dépendance à l'adresse IP.
- Limitation de débit **par clé** et par preuve de travail, pas par IP (par la voie onion, toutes les requêtes semblent venir du même point).

### Impact sur la persistance du pseudonyme (ajustement de D06)

Tor Browser **efface le stockage à la fermeture** et le désactive en navigation privée. Le stockage par IndexedDB ne suffit donc pas pour ces utilisateurs. Pour eux, la connexion passe par :

- **l'import de la phrase de récupération**, ou
- **un fichier de clé** chiffré, à rouvrir à chaque session.

L'écriture doit rester utilisable en mode « standard » de Tor Browser. Le mode « le plus sûr » désactive JavaScript : la **lecture** fonctionne sans JS, pas l'écriture.

## Observabilité sans fuite

- Métriques **agrégées** sans adresse IP (Prometheus ou équivalent auto-hébergé).
- Pas de SaaS d'erreurs.
- Journaux d'application sans données de requête identifiantes.

## Ce qui est écarté

- **Elasticsearch, Kafka, Kubernetes** : trop lourds pour le besoin.
- **SaaS** (Sentry, Algolia, Auth0, Firebase, reCAPTCHA).
- **Réseaux décentralisés** (Nostr, IPFS, AT Protocol) : la modération légale, le retrait et la gestion de clés par le grand public y sont bien plus difficiles. Serveur central retenu, avec des données **signées et exportables** pour ne pas fermer la porte à une fédération ultérieure.

## Points délicats

1. **Archivage des sources** (phase 2) : un robot qui télécharge des pages externes expose l'IP du serveur et ouvre un risque de requêtes vers des adresses internes (SSRF). À isoler dans un conteneur sans accès au réseau interne et à limiter fortement. **Traité par D15** : robot séparé (`scripts/archiver.ts`), adresses internes refusées à la résolution DNS, instantané textuel uniquement.
2. **Tirage au sort du jury** : prévoir un tirage vérifiable (engagement puis révélation) pour qu'aucun acteur ne puisse le truquer.
3. **Canonicalisation des signatures** : un écart de sérialisation entre client et serveur invalide les textes. Tests de propriété indispensables.

## Questions ouvertes

- Schéma de dérivation exact des pseudonymes (SLIP-0010 ou équivalent).
- Difficulté de la preuve de travail.
- Choix définitif de l'hébergeur après lecture des conditions.
- Capacité du serveur unique et seuil de passage à deux machines.
