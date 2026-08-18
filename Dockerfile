# Build + runtime image for Panorámica intranet.
# Multi-stage: el builder compila `canvas` desde fuente y hace el build de Vite/esbuild;
# el runtime se queda solo con las libs runtime de Chromium (sin toolchain de C).
# Railway elige Dockerfile sobre nixpacks.toml cuando está presente.

# ---------------------------------------------------------------------------
# Stage 1: builder
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder

# Runtime libs de Chromium + toolchain para compilar `canvas` (node-gyp).
# Combinado en una sola RUN para evitar capas extra y reusar el apt-get update.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    # Chromium runtime libs (@sparticuz/chromium / puppeteer-core)
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    # Build toolchain para el módulo nativo `canvas`
    build-essential \
    pkg-config \
    python3 \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# No descargar Chromium del paquete `puppeteer` (usamos @sparticuz/chromium).
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true

# Instalar deps.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund --prefer-offline

# Resto del código y build.
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

# Solo las libs runtime de Chromium (sin -dev, sin build-essential, sin python3),
# MÁS las libs runtime contra las que queda linkeado `canvas` cuando el builder lo
# compila desde fuente: libgif7, libjpeg62-turbo y librsvg2-2 (las contrapartes de
# libgif-dev, libjpeg-dev y librsvg2-dev del stage builder). Sin ellas el binario
# compilado que llega vía `COPY --from=builder .../node_modules` no puede abrir
# libgif.so.7 y el server muere al arrancar con ERR_DLOPEN_FAILED: `canvas` se
# carga en el import de server/pdf-to-image.ts, o sea en el arranque, no lazy.
# Cuando npm baja el prebuilt de `canvas` esto no se nota, porque el prebuilt trae
# sus propias libs adentro; el bug aparece solo en los builds que compilan.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libgif7 \
    libglib2.0-0 \
    libgtk-3-0 \
    libjpeg62-turbo \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    librsvg2-2 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production

# Copiar solo lo necesario del builder. node_modules incluye devDeps porque
# `db:push` (drizzle-kit) corre en startup y está en devDependencies.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/migrations ./migrations
# CSV de regiones que el server lee en runtime (comunaRegionService.ts).
COPY --from=builder /app/attached_assets ./attached_assets

EXPOSE 8080

# Serve directly. El schema se aplica en runtime vía bootstrapDatabase() +
# runProductionMigrations() (server/index.ts), envueltos en try/catch para que
# nunca bloqueen el listen(). NO usar `db:push` acá: drizzle-kit push es
# interactivo y en un contenedor sin TTY se cuelga/falla, y con `&&` impedía
# que el server arrancara → "Application failed to respond" en Railway.
CMD ["npm", "start"]
