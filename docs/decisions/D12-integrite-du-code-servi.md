# D12. Intégrité du code servi aux navigateurs

- **Date :** 2026-10-22
- **Statut :** proposé, à valider

## Problème

La clé de chaque auteur vit dans son navigateur (D01, D06). Le JavaScript servi par le site peut la lire. Un serveur compromis, ou une release piégée, peut donc voler les clés de tous les auteurs qui se connectent, sans trace côté serveur. La sécurité de l'identité ne vaut que ce que vaut l'intégrité du code servi.

## Décision

1. **Code source public.** Sans lui, aucune vérification n'a de sens.
2. **Build reproductible du code client** : deux builds du même commit dans des conditions différentes produisent des fichiers identiques. Contrôlé à chaque PR.
3. **Manifeste signé à chaque release** : SHA-256 de chaque fichier client et une racine, signés par Sigstore au nom du workflow de release, au tag exact. Les signatures sont inscrites au journal de transparence public Rekor.
4. **Le serveur annonce** sa version et sa racine sur `/.well-known/maieutik/build.json`.
5. **Vérification externe chaque heure**, par la voie clearnet et par la voie onion : chaque fichier, sous chaque encodage servi (brut, gzip, brotli), et chaque script référencé par les pages doivent correspondre au manifeste signé. N'importe qui peut lancer la même vérification (`scripts/ci/verify-production.sh`).
6. **Le serveur refuse de déployer** un artefact non signé par le workflow de release ([deploy/deploy.sh](../../deploy/deploy.sh)).

La racine se recalcule avec les outils standards, depuis le dossier du code client (`sha256sum` en mode texte, le défaut sous Linux) :

```bash
find . -type f -printf '%P\n' | LC_ALL=C sort | xargs -d '\n' sha256sum | sha256sum
```

## Ce que cela garantit, et ce que cela ne garantit pas

| Garanti                                                                    | Non garanti                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Une modification durable du code servi est détectée en une heure au plus   | Une attaque **ciblée** : servir un script piégé à un seul visiteur, pas au vérificateur     |
| Le code servi correspond à un code source public, relu, au commit signé    | Un script injecté dans le HTML dynamique : la CSP est produite par le même serveur          |
| Une release ne peut pas être déployée sans passer par le workflow de release | La compromission du workflow lui-même (voir 09 : relecture, règle des deux personnes)     |

## Alternatives écartées

- **Faire confiance au serveur seul** : aucun moyen de détecter une compromission sans journal.
- **SRI (Subresource Integrity) seul** : le HTML qui porte les empreintes vient du même serveur ; il ne protège que contre un CDN, que le projet n'utilise pas.
- **Application native** : les magasins exigent des comptes identifiés (08).

## Mesures complémentaires à étudier

Elles réduisent l'impact de ce qui n'est pas garanti ci-dessus.

- **Clés WebCrypto non extractibles** : après création ou import, la clé dérivée est importée en `CryptoKey` Ed25519 non extractible. Un script injecté pourrait signer pendant la session, mais pas emporter la clé. La graine n'est montrée qu'une fois, pour la sauvegarde. Croise la question ouverte de 03 (libsodium ou WebCrypto).
- **Origine dédiée à l'identité** : la page qui détient la clé est servie depuis une origine distincte, entièrement statique (donc couverte par le manifeste) ; les autres pages lui demandent des signatures par `postMessage`. Une XSS dans un texte n'atteint alors plus le stockage de la clé. Coût : un second domaine et une seconde adresse onion.
- **Épinglage par service worker** : la PWA refuse d'activer une nouvelle version du code si son manifeste n'est pas signé. Protège les visiteurs réguliers, pas ceux de Tor Browser, dont le stockage est effacé.

## Conséquences

- Configuration SvelteKit : `version.name` fixé par la CI ; sinon `_app/version.json` porte l'horodatage du build et casse la reproductibilité (constaté sur le code actuel, voir 10 §2).
- Toute ressource servie doit être statique et versionnée, ou exclue explicitement du manifeste.
- Contrôles : [scripts/ci/client-manifest.mjs](../../scripts/ci/client-manifest.mjs), [verify-production.yml](../../.github/workflows/verify-production.yml).
