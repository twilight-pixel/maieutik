#!/usr/bin/env bash
# Déploiement d'une version signée sur le serveur de production. Voir docs/10-ci-cd.md §6.
#
#   sudo deploy.sh v1.4.0       télécharge, vérifie et déploie la version
#   sudo deploy.sh --rollback   réactive la version précédente (sans migration)
#
# La CI ne détient aucun accès à la production. C'est le serveur qui tire la release et
# refuse tout artefact qui n'a pas été signé par .github/workflows/release.yml au tag demandé.
#
# Configuration : /etc/maieutik/deploy.conf
#   MAIEUTIK_REPO=organisation/maieutik
#   MAIEUTIK_DOMAIN=exemple.org
#   BACKUP_RECIPIENT=age1...        clé publique age des sauvegardes (la clé privée est hors ligne)
#   MAIEUTIK_REFERENT_KEYS=...      clés publiques des référents juridiques (docs/05)
#   MAIEUTIK_TEAM_KEYS=...          facultatif : clés des pseudonymes d'équipe (D18)
#   MAIEUTIK_INVITATIONS_REQUIRED=true  facultatif : inscription sur invitation (D18)
set -euo pipefail
umask 077

CONFIG=/etc/maieutik/deploy.conf
SECRETS_DIR=/etc/maieutik/secrets
RELEASES=/opt/maieutik/releases
STATE=/var/lib/maieutik
BACKUPS=/var/backups/maieutik
ISSUER=https://token.actions.githubusercontent.com

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERREUR : %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "à lancer en root"
for bin in cosign docker curl age tar; do command -v "$bin" >/dev/null || die "$bin introuvable"; done
# shellcheck source=/dev/null
source "$CONFIG"
: "${MAIEUTIK_REPO:?}" "${MAIEUTIK_DOMAIN:?}" "${BACKUP_RECIPIENT:?}"
mkdir -p "$RELEASES" "$STATE" "$BACKUPS"

compose() {
  local dir=$1; shift
  docker compose --project-directory "$dir" -f "$dir/compose.yaml" --env-file "$dir/deploy.env" "$@"
}

current_version() { cat "$STATE/current" 2>/dev/null || true; }

# Vérifie la présence de la version attendue derrière Caddy, de bout en bout.
smoke_test() {
  local version=$1 dir=$2 root info
  root=$(sed -n 's/^  "root": "\([0-9a-f]\{64\}\)",$/\1/p' "$dir/client-manifest.json")
  info=$(curl -fsS --max-time 10 --resolve "$MAIEUTIK_DOMAIN:443:127.0.0.1" \
    "https://$MAIEUTIK_DOMAIN/.well-known/maieutik/build.json") || return 1
  grep -q "\"version\": *\"$version\"" <<<"$info" && grep -q "\"root\": *\"$root\"" <<<"$info"
}

activate() {
  local version=$1 dir="$RELEASES/$1"
  log "démarrage de $version"
  compose "$dir" --profile onion up -d --wait --build --remove-orphans

  # Premier démarrage : l'adresse onion n'existe qu'une fois Tor lancé.
  local onion
  onion=$(compose "$dir" --profile onion exec -T tor cat /var/lib/tor/maieutik/hostname 2>/dev/null || true)
  if [[ -n $onion ]] && ! grep -qx "MAIEUTIK_ONION=$onion" "$dir/deploy.env"; then
    sed -i '/^MAIEUTIK_ONION=/d' "$dir/deploy.env"
    echo "MAIEUTIK_ONION=$onion" >>"$dir/deploy.env"
    compose "$dir" up -d --wait caddy
  fi

  smoke_test "$version" "$dir"
}

rollback() {
  local previous
  previous=$(cat "$STATE/previous" 2>/dev/null) || die "aucune version précédente enregistrée"
  log "retour à $previous"
  activate "$previous" || die "le retour à $previous a échoué : intervention manuelle requise"
  echo "$previous" >"$STATE/current"
  log "$previous active"
}

if [[ ${1:-} == --rollback ]]; then rollback; exit 0; fi

VERSION=${1:?usage : deploy.sh vX.Y.Z | --rollback}
[[ $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "version invalide : $VERSION"
[[ $VERSION != "$(current_version)" ]] || die "$VERSION est déjà active"

DIR="$RELEASES/$VERSION"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
IDENTITY="https://github.com/$MAIEUTIK_REPO/.github/workflows/release.yml@refs/tags/$VERSION"

# 1. Téléchargement de la release.
log "téléchargement de $VERSION"
for f in image-digest.txt deploy-bundle.tar.gz deploy-bundle.tar.gz.sigstore.json \
         client-manifest.json client-manifest.json.sigstore.json; do
  curl -fsSL --proto '=https' -o "$TMP/$f" \
    "https://github.com/$MAIEUTIK_REPO/releases/download/$VERSION/$f"
done

# 2. Vérification : chaque artefact doit être signé par release.yml, au tag exact demandé.
log "vérification des signatures (identité $IDENTITY)"
for f in deploy-bundle.tar.gz client-manifest.json; do
  cosign verify-blob --bundle "$TMP/$f.sigstore.json" \
    --certificate-identity "$IDENTITY" --certificate-oidc-issuer "$ISSUER" "$TMP/$f" >/dev/null \
    || die "signature invalide : $f"
done
DIGEST=$(tr -d '[:space:]' <"$TMP/image-digest.txt")
[[ $DIGEST =~ ^sha256:[0-9a-f]{64}$ ]] || die "digest invalide : $DIGEST"
IMAGE="ghcr.io/${MAIEUTIK_REPO,,}@$DIGEST"
cosign verify --certificate-identity "$IDENTITY" --certificate-oidc-issuer "$ISSUER" "$IMAGE" >/dev/null \
  || die "signature de l'image invalide : $IMAGE"

# 3. Installation de la configuration vérifiée.
rm -rf "$DIR" && mkdir -p "$DIR"
tar -xzf "$TMP/deploy-bundle.tar.gz" -C "$DIR" --no-same-owner
cp "$TMP/client-manifest.json" "$DIR/"
PREVIOUS=$(current_version)
ONION=$(grep -s '^MAIEUTIK_ONION=' "$RELEASES/$PREVIOUS/deploy.env" | cut -d= -f2- || true)
cat >"$DIR/deploy.env" <<EOF
MAIEUTIK_IMAGE=$IMAGE
MAIEUTIK_DOMAIN=$MAIEUTIK_DOMAIN
MAIEUTIK_ONION=$ONION
MAIEUTIK_SECRETS_DIR=$SECRETS_DIR
MAIEUTIK_REFERENT_KEYS=${MAIEUTIK_REFERENT_KEYS:-}
MAIEUTIK_TEAM_KEYS=${MAIEUTIK_TEAM_KEYS:-}
MAIEUTIK_INVITATIONS_REQUIRED=${MAIEUTIK_INVITATIONS_REQUIRED:-false}
EOF

log "téléchargement de l'image $IMAGE"
compose "$DIR" pull app

# 4. Sauvegarde chiffrée avant migration (seule la clé publique age est sur le serveur).
if [[ -n $PREVIOUS ]]; then
  BACKUP="$BACKUPS/avant-$VERSION-$(date -u +%Y%m%d).dump.age"
  log "sauvegarde vers $BACKUP"
  compose "$RELEASES/$PREVIOUS" exec -T db pg_dump -U maieutik -Fc maieutik \
    | age -r "$BACKUP_RECIPIENT" >"$BACKUP"
  [[ -s $BACKUP ]] || die "sauvegarde vide"
fi

# 5. Migrations : uniquement additives (expand/contract), la version précédente reste compatible.
log "migrations"
compose "$DIR" --profile tools run --rm migrate || die "migration échouée, rien n'a été basculé"

# 6. Bascule, test de fumée, retour arrière automatique en cas d'échec.
if activate "$VERSION"; then
  [[ -n $PREVIOUS ]] && echo "$PREVIOUS" >"$STATE/previous"
  echo "$VERSION" >"$STATE/current"
  log "$VERSION active"
else
  log "échec du démarrage ou du test de fumée de $VERSION"
  [[ -n $PREVIOUS ]] || die "première installation en échec : rien à restaurer"
  echo "$PREVIOUS" >"$STATE/previous"
  rollback
  exit 1
fi
