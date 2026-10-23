# 02. Analyse juridique

> Ce document n'est pas un avis juridique. Il sert à cadrer les décisions.
> Les points ⚠️ doivent être validés par un avocat en droit du numérique, en France et dans le pays d'hébergement.

## 1. Hébergement hors UE : portée réelle

| Règle | Effet |
|---|---|
| **DSA (règlement UE 2022/2065)** | S'applique à tout service ciblant des utilisateurs de l'UE. Un opérateur non-UE doit désigner un **représentant légal dans l'UE** (art. 13). |
| **RGPD** | S'applique aussi aux opérateurs non-UE ciblant des résidents UE (art. 3.2). Une clé publique liée à un historique d'écrits peut être une donnée personnelle. Représentant UE requis (art. 27). |
| **Droit pénal français** | Vise les personnes : un opérateur résidant en France reste justiciable en France. |
| **Blocage et déréférencement** | Les autorités peuvent ordonner le blocage en France (LCEN, loi SREN 2024) et agir sur les intermédiaires (domaine, CDN, hébergeur, paiement). |

**Conclusion :** l'hébergement hors UE réduit l'exposition sans l'annuler. Le facteur décisif est le lieu de résidence et d'établissement des opérateurs.

## 2. Statut : hébergeur

- Régime de non-responsabilité tant qu'il n'y a pas de **connaissance effective** d'un contenu illicite et que le retrait est prompt une fois informé (DSA art. 6, LCEN art. 6).
- **Pas d'obligation de surveillance générale** (DSA art. 8).
- **Ne pas devenir éditeur.** Toute mise en avant éditoriale expose à la responsabilité d'éditeur. La curation doit rester **neutre et automatique** : règles publiques, pas de « une » choisie par l'équipe.
- Le système de qualification communautaire (voir 05) crée une **connaissance effective** dès qu'un contenu est qualifié d'illégal : il faut agir sur ces signalements.
- DSA art. 7 : les enquêtes volontaires de bonne foi n'entraînent pas la perte de l'exemption.

## 3. Obligations de base (si le service cible l'UE)

Les micro et petites entreprises sont exemptées de certaines obligations (art. 19), mais restent soumises à :

- Conditions d'utilisation claires (art. 14).
- Point de contact autorités et utilisateurs (art. 11, 12).
- Mécanisme de signalement (art. 16).
- Motivation de chaque restriction (art. 17). **À prévoir dès le départ**, avec recours interne même si exempté.
- Signalement des soupçons d'infractions graves menaçant des vies (art. 18).
- Réponse aux injonctions de retrait (art. 9) et d'information (art. 10), **uniquement sur les données détenues**.

## 4. Conservation des données d'identification : conflit identifié

La LCEN (art. 6-II) et le décret 2011-219 imposent aux hébergeurs de conserver pendant un an des données permettant d'identifier l'auteur d'un contenu (identifiant de connexion, adresse IP, date et heure, etc.). Le défaut de conservation est pénalement sanctionné ⚠️ (de l'ordre d'un an de prison et 250 000 € ; montant à vérifier).

**Décision D01 / D02 :** le projet ne conserve pas ces données. Ce choix est cohérent avec le principe d'anonymat et entre en conflit avec le droit français s'il s'applique à l'opérateur. Le risque est **accepté pour l'instant** et doit être **revalidé avant lancement** (voir D02).

## 5. Contenus illicites à connaître

| Domaine | Exemples |
|---|---|
| Loi de 1881 sur la presse | Diffamation, injure, provocation à la haine, négationnisme. |
| Code pénal | Apologie du terrorisme, pédocriminalité, harcèlement, incitation au suicide, divulgation de données personnelles dans l'intention de nuire. |
| Délais courts | Règlement UE sur les contenus terroristes : retrait en 1 heure sur ordre. Loi SREN : retrait des contenus pédocriminels sous 24 heures après notification. |
| Propriété intellectuelle | Contrefaçon : retrait sur notification ; droit de courte citation pour les extraits. |
| Pédocriminalité | Tolérance zéro, signalement à PHAROS, détection par empreinte numérique envisageable pour les images. |

## 6. Contenu sexuel explicite

Un contenu pornographique accessible aux mineurs expose à des sanctions pénales (Code pénal 227-24) et la loi SREN impose une vérification d'âge aux sites concernés. Vérification d'âge et anonymat sont incompatibles.

**Décision D04 :** pornographie interdite. Les avertissements couvrent les autres contenus sensibles (voir 06).

## 7. Structure et dons

- Forme envisagée : association de droit suisse (art. 60 CC) ou fondation ; Islande en alternative ⚠️.
- Dons non déductibles en France si l'entité est étrangère.
- Paiements des donateurs séparés de tout pseudonyme.
- Pas de publicité, pas de pistage.

## 8. À faire avant le lancement

- [ ] Consulter un avocat (FR + juridiction d'hébergement) pour valider 4 et la structure d'entité.
- [ ] Désigner le **représentant légal UE** (DSA art. 13) et le représentant RGPD (art. 27).
- [ ] Rédiger les conditions d'utilisation : types de contenus interdits, procédure de signalement, recours.
- [ ] Définir le **point de contact** autorités / utilisateurs.
- [ ] Définir la procédure de **traitement des injonctions** (retrait, information, urgence).
- [ ] Choisir et ouvrir un compte de réception de dons indépendant des pseudonymes.
- [ ] Vérifier les risques côté intermédiaires (domaine, CDN, hébergeur, paiement) et prévoir des plans de repli.
