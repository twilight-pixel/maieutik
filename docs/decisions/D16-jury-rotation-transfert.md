# D16. Jury tiré au sort vérifiable, rotation de clé, transfert et export

- **Date :** 2026-10-23
- **Statut :** validé (implémentation de la phase 3) ; seuils provisoires ⚠️

## 1. Jury tiré au sort (niveau 2, D03)

### Aiguillage d'un signalement

| Cas | Traitement |
|---|---|
| Catégorie manifestement illégale (pédocriminalité, apologie du terrorisme) et signaleur ancien de 30 jours au moins | **Masquage conservatoire immédiat**, décision publiée au journal, puis examen par le référent. Pas de jury, pour ne pas exposer des bénévoles. |
| Vivier suffisant de volontaires éligibles | **Jury de 9 pseudonymes tirés au sort** |
| Sinon | Référent juridique (démarrage) |

Un pseudonyme est éligible s'il remplit toutes ces conditions :
- il est volontaire (déclaration signée) ;
- il a au moins **90 jours** ;
- il n'a pas été déplacé (rotation) ;
- il n'est ni l'auteur du texte, ni le signaleur, ni l'auteur d'un texte qui discute le texte signalé.

Le jury n'est tiré que si le vivier compte **au moins 27 éligibles**.

### Tirage vérifiable (engagement puis révélation)

1. Le serveur tire une graine par jour et en publie l'empreinte **deux jours à l'avance** (`/jurys`).
2. Le tirage utilise la graine du jour du signalement. Chaque éligible reçoit pour score `SHA-256(graine, identifiant du signalement, clé)` ; les 9 plus petits scores sont retenus. Le code est isomorphe : `src/lib/shared/jury.ts`.
3. La graine d'un jour est publiée le lendemain.

Le serveur ne peut pas choisir la graine après coup, puisque l'engagement est publié avant le signalement. Le signaleur ne connaît pas la graine. Personne ne peut donc orienter la composition du jury.

**Limite connue : l'opérateur connaît la graine à l'avance.** Le serveur détient chaque graine dès son engagement, deux jours avant son usage. Un opérateur malveillant peut donc prévoir la composition des jurys d'un jour, puis choisir quand acheminer un signalement, ou ajuster le vivier en créant des volontaires. Le tirage protège contre le signaleur, pas contre l'opérateur.

Pistes pour fermer ce point :
- **Combiner la graine avec un aléa public publié après l'engagement** : balise drand, ou hachage d'un bloc d'une chaîne publique. L'application n'ayant pas d'accès sortant (docs/10, I13), cet aléa doit être apporté par un composant isolé, comme le robot d'archivage. Il faut aussi pouvoir le vérifier : signature de la balise, ou en-tête du bloc.
- **Rendre le vivier vérifiable** : publier sous forme d'engagement la liste des volontaires de chaque jour avant le tirage, pour qu'un ajout tardif soit visible. **Fait (D18)** : vivier arrêté la veille, empreinte publiée sur `/jurys`.

En attendant, la publication des engagements, des empreintes des viviers et des totaux de votes permet au moins de détecter une manipulation après coup.

Ce qui est public pour chaque jury : le nombre d'éligibles et l'empreinte de leur liste. La liste elle-même et la composition du jury ne le sont pas, pour protéger les jurés. Le référent (ou un auditeur mandaté) peut tout recalculer.

### Vote et issue

- **Vote à l'aveugle**, signé et motivé, consulté et exprimé par requêtes signées (pas de session).
- Les votes individuels ne sont jamais publiés ; seuls les totaux le sont, à la clôture.
- **Clôture** dès que les 9 jurés ont voté, ou à l'échéance de **7 jours**. L'échéance est évaluée à chaque consultation : il n'y a pas de tâche planifiée.

| Issue | Effet |
|---|---|
| Au moins 2/3 des votes exprimés concluent à l'illégalité | Texte masqué, décision publiée (origine « jury ») |
| Moins de 2/3 | Texte maintenu, décision publiée |
| Moins de 5 votes à l'échéance | Renvoi au référent |

Le référent garde le dernier mot : il confirme le retrait ou rétablit le texte.

## 2. Rotation de clé (docs/03)

- Deux enveloppes portent sur le même contenu `{from, to}` : `key-rotation`, signée par l'ancienne clé, et `key-rotation-accept`, signée par la nouvelle.
- L'ancien pseudonyme est marqué « déplacé » : il ne peut plus publier et sa page renvoie au nouveau. Le nouveau affiche « anciennement… » et reprend l'œuvre.
- Côté navigateur, **remplacer la phrase de récupération** fait trois choses :
  1. crée une nouvelle phrase, montrée et vérifiée avant tout envoi ;
  2. recrée chaque pseudonyme sous la nouvelle phrase ;
  3. déplace chacun vers sa nouvelle clé.

  La nouvelle phrase est enregistrée avant la première rotation : une interruption se reprend sans perte.

**Limite assumée** : quelqu'un qui a volé la phrase peut aussi déplacer les pseudonymes le premier. Sans autre racine de confiance (D01), cette course ne peut pas être empêchée ; le premier déplacement l'emporte.

## 3. Transfert entre appareils

- L'appareil source chiffre le coffre avec Argon2id et AES-GCM, sous un **code à usage unique** d'environ 60 bits (trois groupes de quatre caractères). Il l'affiche en **QR code**, généré localement par `uqr` et rendu en SVG, ainsi qu'en texte copiable.
- L'appareil cible lit le QR code avec la caméra (`BarcodeDetector`, quand le navigateur le propose) ou colle le texte, puis saisit le code. **Rien ne passe par le serveur.**
- `Permissions-Policy` autorise donc la caméra pour la seule origine du site (`camera=(self)`).

## 4. Export intégral

`/pseudonymes/<clé>/export.json` (format `maieutik-export/1`) contient toutes les enveloppes signées publiques du pseudonyme : déclaration, rotation, versions de textes, retraits, questions. Chaque élément se vérifie avec la seule clé publique.

## Points ouverts

- Aléa externe pour le tirage (voir « Limite connue » ci-dessus) : à mettre en place avant que le jury ait un rôle réel.

- ⚠️ Seuils (9 jurés, vivier de 27, 90 jours, 7 jours, 2/3, quorum de 5) à confirmer (docs/05, questions ouvertes).
- Recours de l'auteur après une décision du jury : à formaliser (aujourd'hui, par le référent seulement).
- Pondération des signaleurs abusifs (docs/05, garde-fous) : non implémentée.
- Protection psychologique des jurés : avertissement et contenu replié avant lecture ; un accompagnement reste à définir.
