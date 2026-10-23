# D06. Pseudonyme persistant d'une visite à l'autre

- **Date :** 2026-10-22
- **Statut :** validé

## Décision
Le pseudonyme est identique d'une visite à l'autre et d'un appareil à l'autre, sans mot de passe ni e-mail.

## Mise en œuvre
- Clé dérivée d'une graine, conservée chiffrée dans le navigateur, avec stockage persistant demandé.
- Connexion par défi signé.
- Autres appareils : import de la phrase de récupération ou transfert par QR code.
- Nom d'affichage + suffixe d'empreinte immuable (ex. `Hypatie#a3f9`).

## Limite assumée
Sans sauvegarde, la perte de la clé est définitive (aucune récupération par principe).

## Ajustement (voir [D10](D10-stack-technique.md))
Tor Browser efface le stockage à la fermeture et le désactive en navigation privée. Pour ces utilisateurs, la connexion passe par l'import de la phrase de récupération ou d'un fichier de clé chiffré à chaque session.

Détail : [03-anonymat-et-securite.md](../03-anonymat-et-securite.md).
