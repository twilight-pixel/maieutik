# D15. Débat structuré : relations typées, questions, sources archivées

- **Date :** 2026-10-23
- **Statut :** validé (implémentation de la phase 2)

## Décision

### 1. Format du contenu signé d'un texte

- **`relation: { kind, target } | null`** remplace `replyTo`. Il couvre les six relations de docs/04 §3 : répond à, réfute, complète, apporte une preuve, autre interprétation, traduction de.
- **`question: uuid | null`** rattache une **position** à une question. Un texte a soit une relation, soit une question, jamais les deux. Les textes qui discutent une position héritent de sa question (calcul en remontant les relations).
- **`sources: Source[]`** contient les références structurées : `id` (`s1`, `s2`…), titre, auteur, date (année, mois ou jour), éditeur, adresse. Dans le corps, la marque `sourceRef` renvoie à une source et s'affiche en appel de note. Tout renvoi vers une source absente est refusé.

Relation, question, catégorie, langue et type de texte sont **fixés à la version 1** ; les versions suivantes ne les changent pas. Une traduction doit être dans une autre langue que son original.

Le format a changé avant tout lancement public, sans rétrocompatibilité. Après le lancement, toute évolution devra garder vérifiables les enveloppes existantes.

### 2. Questions

Une question est un contenu signé (`kind: question`) : titre, discipline, langue, contexte facultatif. Elle est immuable et peut être posée par n'importe quel pseudonyme.

La vue « positions en présence » montre, pour chaque position, dans l'ordre de publication :
- les relations reçues, par nature ;
- l'étiquette « soutenue » (au moins un complément, une preuve, une interprétation ou une réponse) ;
- l'étiquette « contestée » (au moins une réfutation) ;
- les réfutations restées sans réponse.

### 3. Signaux de découverte (règles publiques)

- **Réfutation sans réponse** : texte visible qui en réfute un autre, et vers lequel aucun texte visible n'a de relation, hors traduction. La page `/a-repondre` les liste, des plus anciennes aux plus récentes.
- Ni popularité, ni choix éditorial : l'ordre ne dépend que des dates et de la structure.

### 4. Archivage des sources

L'application n'a **aucun accès réseau sortant** (docs/10, I13). L'archivage est donc confié à un **robot séparé** (`scripts/archiver.ts`) :

| Élément | Choix |
|---|---|
| Déclenchement | À la publication, chaque adresse citée entre en file (`source_snapshot`, une ligne par adresse). |
| Échanges | Le robot réclame des adresses à l'application et lui renvoie les résultats (`POST /internal/archive/jobs`, `POST /internal/archive/results`), avec un jeton partagé (`ARCHIVER_TOKEN_FILE`). Sans jeton configuré, ces routes répondent 404. |
| Réseau du robot | Internet et l'application, **ni la base ni le réseau interne**. Adresses privées, de boucle locale, de lien local et réservées refusées à la résolution DNS ; la résolution est faite par la connexion elle-même, ce qui empêche le rebinding. Redirections revérifiées (3 au plus), ports 80 et 443 seulement, 2 Mo et 15 s au plus. |
| Contenu conservé | **Texte extrait** (sans balisage, scripts ni ressources) et **empreinte SHA-256** du contenu brut. Aucun HTML d'origine n'est jamais servi aux lecteurs. |
| Échecs | 3 tentatives, puis `failed`. Les refus de sécurité (`refused`) sont définitifs. |

## Raisons

- Les relations typées et les questions sont le cœur du produit (docs/01) ; elles appartiennent au contenu signé pour que l'auteur engage sa signature sur le sens de sa réponse.
- Un instantané textuel suffit à prouver ce que disait une source, sans exposer les lecteurs à un contenu tiers ni ouvrir une surface XSS.

## Points ouverts

- ⚠️ **Droit d'auteur** : conserver et afficher le texte intégral d'une page citée dépasse peut-être le droit de courte citation. Il faudra choisir avec l'avocat entre un extrait borné, une consultation réservée ou la seule empreinte.
- Modération des questions : les signalements visent aujourd'hui les textes. Une question au titre illicite ne peut être retirée que par une décision directe du référent (à ajouter).
- Robot d'archivage : conteneur, réseau, secret et filtrage de `/internal/` par Caddy relèvent du chantier de déploiement (docs/10).
