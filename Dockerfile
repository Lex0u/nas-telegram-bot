# syntax=docker/dockerfile:1

# `canvas` (utilisé par chartjs-node-canvas) est un module natif : il a besoin
# d'un toolchain de compilation + des headers -dev au moment du `npm ci`, mais
# uniquement des libs partagées (.so) à l'exécution. D'où les 4 stages :
# deps/build ont le toolchain complet, prod-deps réinstalle en mode production
# avec le même toolchain, et runtime ne récupère que node_modules + dist déjà
# construits — pas de compilateur dans l'image finale.

ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:${NODE_VERSION} AS prod-deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:${NODE_VERSION} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    smartmontools iputils-ping ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
