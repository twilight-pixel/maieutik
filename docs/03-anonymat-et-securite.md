# 03. Anonymat et sécurité

## Principe

**Pseudonymat fort par clé cryptographique.** Un auteur n'a pas de compte au sens classique : il détient une clé. Sa clé publique est son identité, ses textes sont signés. La plateforme ne connaît ni nom, ni e-mail, ni téléphone, ni adresse IP conservée.

## Ce que la plateforme détient

| Détenu | Non détenu |
|---|---|
| Clé publique du pseudonyme | Nom, e-mail, téléphone |
| Nom d'affichage choisi | Adresse IP (non journalisée) |
| Date de création (jour, sans heure) | Appareil, navigateur, localisation |
| Textes signés et leurs versions | Lien entre deux pseudonymes d'une même personne |

## Pseudonyme persistant (D06)

Exigence : le pseudonyme est le même d'une visite à l'autre et d'un appareil à l'autre, sans mot de passe ni e-mail.

### Création
1. Le navigateur génère une **graine** (phrase de 12 à 24 mots).
2. Le pseudonyme est une **clé dérivée** de la graine (courbe Ed25519, dérivation hiérarchique type SLIP-0010).
3. L'utilisateur choisit un **nom d'affichage** ; il est affiché avec un **suffixe d'empreinte** immuable (ex. `Hypatie#a3f9`), ce qui garantit l'unicité et empêche l'usurpation d'un nom.
4. Une petite **preuve de travail** est demandée à la création (anti-abus, voir plus bas).

### Persistance d'une visite à l'autre
- La clé est conservée **chiffrée** dans le stockage persistant du navigateur (IndexedDB), avec demande de stockage persistant (`navigator.storage.persist()`).
- Protection optionnelle par **phrase secrète locale**, déverrouillée à l'ouverture de l'appareil.
- La connexion est un **défi signé** : le serveur envoie un nonce, le navigateur le signe. Aucun mot de passe, aucune session longue côté serveur : un jeton court est renouvelé silencieusement par signature.
- Tant que la sauvegarde n'est pas confirmée, un rappel visible s'affiche.
- **Dans Tor Browser**, le stockage est effacé à la fermeture et désactivé en navigation privée : la connexion passe par l'import de la phrase de récupération ou d'un fichier de clé chiffré à chaque session (voir 08 et D10).

### Autres appareils
- **Import de la phrase** de récupération.
- **Transfert par QR code** d'un appareil à l'autre, chiffré de bout en bout.

### Plusieurs pseudonymes
La même graine peut dériver plusieurs clés (une par domaine d'expression). Rien dans les données publiques ne permet de les relier. L'utilisateur peut aussi utiliser des graines totalement séparées.

### Perte et compromission
| Situation | Traitement |
|---|---|
| Clé perdue, sans sauvegarde | **Aucune récupération**, par principe. Message très clair à la création. |
| Clé compromise | **Déclaration de rotation** signée par l'ancienne clé, qui désigne la nouvelle ; l'ancien pseudonyme est marqué « déplacé ». La nouvelle clé co-signe (D16). |
| Rotation sans lien voulu | L'auteur peut créer un nouveau pseudonyme sans le relier à l'ancien. |

## Anti-abus sans identité

L'absence de compte identifiable supprime les freins habituels. Remplacements :

1. **Preuve de travail** à la création d'une clé (coût de calcul faible pour un humain, élevé pour un robot).
2. **Limitation de débit** par clé, appliquée en mémoire (pas de journal persistant).
3. **Ancienneté du pseudonyme** : certaines actions (siéger en jury, signaler) se débloquent avec le temps.
4. **Jetons d'invitation** facultatifs au démarrage.
5. **Pondération des signalements** selon leur fiabilité passée.

## Mesures techniques

- **Aucun journal d'accès** : serveur web configuré sans journalisation ni adresse IP dans les logs ; limites de débit en mémoire.
- **Aucun contenu tiers** intégré (pas de vidéos incorporées, pas de polices ou scripts externes, pas d'analytics) : cela divulguerait l'IP du lecteur.
- **Images hébergées** par la plateforme, métadonnées (EXIF, etc.) supprimées à l'envoi.
- **Contenu en données structurées** (blocs signés), pas en HTML brut : prévention des injections.
- **Politique de sécurité de contenu (CSP) stricte**, pas de cookies de suivi.
- **Dates affichées sans heure** ; **publication différée** optionnelle avec décalage aléatoire (D09).
- **Accès par Tor** (service onion) actif dès le lancement (voir 08 et D10).
- **Sauvegardes** : ne contiennent que ce que la plateforme détient déjà (pas de données d'identité).

## Modèle de menaces

| Menace | Impact | Réponse |
|---|---|---|
| Saisie ou fuite de la base | Contenus publics seulement ; aucune identité | Principe de minimisation |
| Demande d'identification par une autorité | Rien à fournir | Voir 02 §4, risque accepté |
| **Stylométrie** (identification par le style d'écriture) | Réidentification d'un auteur | Information claire aux auteurs ; guide de bonnes pratiques |
| Recoupement par les heures de publication | Lien entre pseudonymes | Dates sans heure, publication différée |
| Usurpation de pseudonyme | Fausse attribution de textes | Signature de chaque texte, suffixe d'empreinte |
| Pseudonymes de masse (spam) | Dégradation du site | Preuve de travail, limites, ancienneté |
| Perte de clé | Perte définitive d'une œuvre | Sauvegarde guidée, rappels, transfert QR |
| Appareil compromis | Vol de clé | Chiffrement local, rotation de clé |
| Fuite IP côté intermédiaire (CDN, hébergeur) | Désanonymisation du lecteur ou de l'auteur | Choix d'intermédiaires, accès Tor |

## Questions ouvertes

- Choix de la bibliothèque cryptographique (libsodium ou WebCrypto) et du schéma de dérivation.
- Niveau de difficulté de la preuve de travail.
- Politique de renouvellement des jetons de session.
- Hébergeur et intermédiaires compatibles avec une politique sans journal.
