# D18. Compléments de modération, préférences de lecture, démarrage, application installable

- **Date :** 2026-10-23
- **Statut :** validé ; seuils provisoires ⚠️

## 1. Modération (docs/05)

| Élément | Mise en œuvre |
|---|---|
| **Signalement d'une question** | Contenu signé `question-report` : catégorie légale, justification, et le titre comme passage. Toujours traité par le référent. |
| **Décision visant une question** | Une décision vise un texte **ou** une question (`textId` / `questionId`). Une question est maintenue ou retirée ; ses positions restent publiées. |
| **Recours de l'auteur** | Contenu signé `appeal`, réservé à l'auteur du texte visé, un seul recours en cours par décision. Le référent répond par une décision liée (`appealId`, origine « recours » au journal). Maintenir le texte le rétablit s'il était masqué. |
| **Fiabilité des signaleurs** | Un signaleur dont au moins 80 % des 5 derniers signalements traités (ou plus) ont été classés sans suite est « peu fiable ». Ses signalements vont au référent, sans jury ni masquage conservatoire. Le référent voit cette fiabilité, jamais l'identité du signaleur. |
| **Avertissement manquant** | Toujours traité par le référent, sans jury : ce n'est pas une question de légalité, et le traitement se limite à ajouter l'avertissement (docs/06). |
| **Vivier du jury figé à l'avance** | La liste des volontaires éligibles de chaque jour est arrêtée la veille, et son empreinte est publiée sur `/jurys`. Un volontaire ajouté après coup ne peut pas être tiré ce jour-là. Cela ferme en partie la limite connue de D16 ; l'aléa public externe reste à ajouter. |

## 2. Lecture (docs/06)

- **Préférences d'avertissement** (`/preferences`) : pour chaque catégorie, afficher, replier (par défaut) ou masquer. Le réglage est conservé dans le navigateur (`localStorage`) et n'est jamais envoyé. Sans JavaScript, les contenus avertis restent repliés.
- **Avertissements par bloc** : le bloc signé `warningBlock` (une ou plusieurs catégories, dans l'ordre canonique) enveloppe un passage. Il obéit aux mêmes préférences que l'avertissement d'un texte entier, et reste replié sans JavaScript.
- **Pagination** par liens relatifs, qui conservent la langue et les filtres : recherche, questions, « À répondre », journal, œuvre d'un pseudonyme, réponses sous un texte (`?reponses=`).
- **Rappel des jurés** : un indicateur discret dans l'en-tête signale les votes en attente. La vérification est une requête signée, qui révèle au serveur l'activité du pseudonyme. Elle n'a donc lieu que pour un volontaire déclaré sur cet appareil, et au plus une fois par session de navigation.
- **Recherche filtrée par langue** (`?langue=fr|en`).
- **Tri des questions** sur des signaux structurels : récentes, plus contradictoires (nombre de positions), réfutations sans réponse. Jamais de popularité.

## 3. Démarrage à froid (docs/07)

- **Pseudonymes d'équipe** : les clés listées dans `TEAM_KEYS` sont marquées « équipe » dès leur création et affichées comme telles.
- **Invitations facultatives** : avec `INVITATIONS_REQUIRED=true`, créer un pseudonyme demande un code.
  - Le référent ou l'équipe génère les codes par une requête signée ; ils ne sont montrés qu'une fois.
  - Seule l'empreinte SHA-256 du code est conservée, et rien ne relie un code au pseudonyme qui l'a consommé.

## 4. Application installable (docs/08, PWA)

- Manifeste et icône servis par le site.
- Le service worker met en cache le code et les fichiers statiques. Pour les pages, c'est le réseau d'abord : la copie en cache ne sert que hors connexion.
- L'API, l'interface interne, les exports et `.well-known` ne sont jamais mis en cache.

## Points ouverts

- ⚠️ Seuils de fiabilité (5 signalements, 80 %) à confirmer.
- Le recours est examiné par le référent seul : un second niveau (autre référent, jury de recours) reste à définir.
