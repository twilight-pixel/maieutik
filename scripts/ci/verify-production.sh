#!/usr/bin/env bash
# Vérifie que le code client servi en production est exactement celui d'une release signée (D12).
# Lancé chaque heure par .github/workflows/verify-production.yml ; utilisable par n'importe qui.
#
#   verify-production.sh <url-de-base> [proxy-socks5]
#   ex. : verify-production.sh https://exemple.org
#         verify-production.sh http://xxxx.onion 127.0.0.1:9050
#
# Prérequis : curl, node ≥ 22, cosign. Dépôt : MAIEUTIK_REPO, sinon GITHUB_REPOSITORY.
set -euo pipefail

BASE=${1:?usage : verify-production.sh <url-de-base> [proxy-socks5]}
SOCKS=${2:-}
REPO=${MAIEUTIK_REPO:-${GITHUB_REPOSITORY:?définir MAIEUTIK_REPO=organisation/depot}}
HERE=$(dirname "$0")

curl_opts=(-fsS --max-time 120)
[[ -n $SOCKS ]] && curl_opts+=(--socks5-hostname "$SOCKS")

# 1. Version annoncée par le serveur (non fiable en soi : on vérifie tout ce qui suit).
VERSION=$(curl "${curl_opts[@]}" "$BASE/.well-known/maieutik/build.json" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))')
[[ $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version annoncée invalide : $VERSION" >&2; exit 1; }
echo "Version annoncée : $VERSION"

# 2. Manifeste de cette version, signé par le workflow de release au tag exact.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
for f in client-manifest.json client-manifest.json.sigstore.json; do
  curl -fsSL --proto '=https' -o "$tmp/$f" "https://github.com/$REPO/releases/download/$VERSION/$f"
done
cosign verify-blob --bundle "$tmp/client-manifest.json.sigstore.json" \
  --certificate-identity "https://github.com/$REPO/.github/workflows/release.yml@refs/tags/$VERSION" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  "$tmp/client-manifest.json"

# 3. Chaque fichier servi, sous chaque encodage, contre le manifeste signé.
args=(--page /)
if [[ -n $SOCKS ]]; then args+=(--socks5 "$SOCKS"); else args+=(--cert-days 14); fi
node "$HERE/client-manifest.mjs" verify-remote "$tmp/client-manifest.json" --base "$BASE" "${args[@]}"
