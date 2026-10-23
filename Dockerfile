# syntax=docker/dockerfile:1
# Image de l'application (SvelteKit, adaptateur Node). Voir docs/10-ci-cd.md §5.
#
# Build reproductible : mêmes sources + même MAIEUTIK_VERSION => même code client,
# vérifié en CI par scripts/ci/client-manifest.mjs compare (D12).

FROM node:25-trixie-slim@sha256:aabbe39553d15ede8a97cc60c9e1a97034ff772afcf696ea42b94e7f5f2ec71b AS build
ENV PNPM_HOME=/pnpm CI=true
# Version de pnpm lue dans le champ packageManager de package.json.
RUN corepack enable
WORKDIR /src

# Dépendances d'abord (cache). pnpm bloque les scripts d'installation hors liste blanche.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile

COPY . .
ARG MAIEUTIK_VERSION=dev
ENV MAIEUTIK_VERSION=$MAIEUTIK_VERSION
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline \
 && pnpm build \
 && node scripts/ci/client-manifest.mjs generate build/client \
      --version "$MAIEUTIK_VERSION" --out build/client-manifest.json \
 && pnpm prune --prod

# Exécution : distroless, sans shell ni gestionnaire de paquets, utilisateur non root.
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:78f07ef1b5ea71ad7c055df15d0dd8997f2d288f9158623c4d4ae3d765b7d50d
WORKDIR /app
COPY --from=build /src/package.json ./
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/build ./build
# Migrations, lancées par le service « migrate » de deploy/compose.yaml.
COPY --from=build /src/scripts/migrate.ts ./scripts/migrate.ts
COPY --from=build /src/src/lib/server/db-options.ts ./src/lib/server/db-options.ts
COPY --from=build /src/db/migrations ./db/migrations
# Robot d'archivage, lancé par le service « archiver » (même image, autre commande).
COPY --from=build /src/scripts/archiver.ts ./scripts/archiver.ts
COPY --from=build /src/src/lib/server/archive-safety.ts ./src/lib/server/archive-safety.ts
USER 65532:65532
EXPOSE 3000
CMD ["build/index.js"]
