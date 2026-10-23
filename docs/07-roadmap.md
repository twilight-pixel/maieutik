# 07. Roadmap

Principe : **complétude dès le lancement** (8 catégories, FR et EN). La progression se fait par fonctionnalités, pas par réduction des catégories.

## Phase 0. Cadrage

- [ ] Consultation juridique (voir 02 §8).
- [ ] Choix du nom définitif, du domaine et de la structure d'entité.
- [ ] Choix de l'hébergeur et des intermédiaires compatibles avec « sans journal ».
- [ ] Définition des seuils de modération (jury, ancienneté).
- [ ] Désignation du référent juridique.
- [ ] Prototype d'identité par clé (génération, sauvegarde, transfert) à tester auprès de non-techniciens.
- [ ] Forge, protections de branche et de tag, environnement `release`, équipes CODEOWNERS (voir 10 §10 et D11).

## Phase 1. Socle publiable

- Identité par clé, pseudonyme persistant, sauvegarde guidée.
- Éditeur par blocs (jeu de blocs de base), avertissements de contenu.
- 8 catégories avec sous-catégories, étiquettes libres, FR / EN.
- Publication d'un texte, réponse liée (« répond à »), versions publiques, retrait avec trace.
- Recherche plein texte.
- Signalement motivé traité par le **référent juridique**.
- Journal public des retraits.
- Publication différée, dates sans heure.
- Preuve de travail et limites de débit.
- **Service Tor onion actif dès le lancement** (voir 08 et D10).
- Release signée, build reproductible, vérification horaire du code servi (voir 10 et D12).
- *Proposé :* format et vérification de la **déclaration de rotation de clé**, avancés de la phase 3 : sans eux, aucun remède si le code servi est compromis (voir 09 §6).

## Phase 2. Débat structuré

> Implémentée le 2026-10-23 (D15), sauf le déploiement du robot d'archivage.

- Relations argumentatives typées (réfute, complète, preuve, interprétation).
- Questions et dossiers, vue « positions en présence ».
- Sources structurées avec instantané archivé.
- Signaux de découverte (réfutations sans réponse, couverture contradictoire).
- Relation « traduction de ».

## Phase 3. Jury et durabilité

> Implémentée le 2026-10-23 (D16, D17). Seuils du jury provisoires.

- Activation du **jury tiré au sort** quand le seuil de jurés éligibles est atteint.
- Rotation de clé, transfert par QR.
- Éditeur enrichi : tableaux, formules, encadrés, colonnes, frises, schémas (D17). Restent les images et les pièces jointes, qui demandent un stockage et une décision à part.
- Export intégral des textes d'un pseudonyme.

## Démarrage à froid

La complétude dès le départ crée le risque d'une « bibliothèque vide ». Mesures :

1. **Textes du domaine public**, sourcés et correctement présentés, dans chaque catégorie.
2. **Grandes questions** posées par l'équipe, avec les positions classiques déjà exposées.
3. Textes fondateurs rédigés par l'équipe dans chaque catégorie, signés par des pseudonymes d'équipe **identifiés comme tels**.
4. Jetons d'invitation facultatifs pour les premiers auteurs (en place : `INVITATIONS_REQUIRED`, D18). Pseudonymes d'équipe identifiés par `TEAM_KEYS`.

Les pseudonymes d'équipe de production viennent de phrases secrètes générées hors ligne, jamais de `scripts/seed.ts` : ses clés dérivent de libellés publics et le script refuse toute adresse non locale.

À clarifier : ces contenus d'amorçage respectent la **neutralité éditoriale** (voir 02 §2) s'ils sont présentés comme contributions de pseudonymes parmi d'autres, sans mise en avant éditoriale.

## Questions ouvertes (consolidées)

| Sujet | Question |
|---|---|
| Juridique | Valider le risque LCEN avec un avocat avant lancement |
| Juridique | Structure d'entité (association suisse, fondation, autre) |
| Modération | Seuils du jury, liste des catégories légales |
| Modération | Qui est le référent juridique ? |
| Technique | Bibliothèque cryptographique, difficulté de la preuve de travail |
| Technique | Archivage d'instantanés de sources |
| Produit | Pièces jointes (PDF, audio, vidéo) |
| Produit | Nom définitif et identité visuelle |
| Contenu | Origine et sélection des textes d'amorçage |
| Sécurité | Valider D11 (forge) et D12 (intégrité du code servi) ; canal de signalement chiffré (voir 09) |
