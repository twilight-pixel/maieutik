# D14. Écritures signées sans session ; preuve de travail implémentée en interne

- **Date :** 2026-10-22
- **Statut :** validé (implémentation de la phase 1)

## Décision

1. **Aucune session côté serveur.** Chaque écriture est un contenu signé autonome. Le serveur vérifie la signature à la réception, et il n'y a ni jeton, ni cookie, ni défi de connexion. Cela concerne : pseudonyme, version de texte, retrait, signalement, décision du référent.
   - Rejeu : sans effet, car les identifiants sont fixés par le client (UUID) et les numéros de version sont stricts.
   - Accès du référent aux signalements : requête signée horodatée, valable 5 minutes.
2. **Preuve de travail : protocole d'Altcha, implémenté dans `src/lib/shared/pow.ts`** plutôt qu'avec le paquet `altcha`.
   - Le serveur publie SHA-256(sel + nombre secret), signé par HMAC, avec une expiration.
   - Le navigateur retrouve le nombre par force brute.
   - Le serveur refuse le rejeu grâce à une liste en mémoire.
3. **Publication différée** : la date de publication est tirée entre J+1 et J+3. Le texte devient visible quand elle est atteinte, sans tâche planifiée. Pour un texte différé, la base enregistre cette date comme date de création : elle ne garde pas le jour réel de l'envoi.

## Raisons

- Moins d'état serveur, donc moins à fuiter (docs/03). Rien ne relie deux requêtes entre elles.
- La signature prouve l'auteur de chaque écriture, ce qu'une session ne fait pas.
- Pas de nouvelle dépendance cliente pour la preuve de travail : `@noble/hashes` est déjà présent et audité.

## Ajustement de docs/03 et D06

La « connexion par défi signé avec jeton court » n'est pas nécessaire en phase 1. Elle reviendra seulement si une lecture privée apparaît (par exemple, ses propres textes différés avant publication).

## Conséquences

- La clé HMAC des preuves de travail est lue dans `SESSION_KEY_FILE` (secret Docker). Sans ce fichier, elle est tirée au hasard à chaque démarrage, et les défis en cours deviennent invalides.
- Les référents sont désignés par leur clé publique dans `REFERENT_KEYS`.
- L'anti-rejeu des preuves de travail et les limites de débit vivent **en mémoire, par processus**. C'est cohérent avec le serveur unique (D10). Si l'application tourne un jour sur plusieurs processus ou machines, il faudra les déplacer en base (table de défis consommés, avec expiration).
