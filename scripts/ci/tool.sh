#!/usr/bin/env bash
# Lance un outil de sécurité depuis son image épinglée dans .github/tools/Dockerfile.
#
#   scripts/ci/tool.sh <outil> [arguments...]
#
# Le dossier courant est monté en /src (dossier de travail du conteneur).
# Options Docker supplémentaires : variable TOOL_DOCKER_ARGS (ex. "--network host -e GH_TOKEN").
set -euo pipefail

name=${1:?usage : tool.sh <outil> [arguments...]}
shift
registry="$(dirname "$0")/../../.github/tools/Dockerfile"
image=$(awk -v n="$name" 'toupper($1) == "FROM" && tolower($NF) == n { print $2 }' "$registry")
[[ -n $image ]] || { echo "outil inconnu : $name (voir $registry)" >&2; exit 2; }

read -r -a extra <<<"${TOOL_DOCKER_ARGS:-}"
exec docker run --rm "${extra[@]}" -v "$PWD:/src" -w /src "$image" "$@"
