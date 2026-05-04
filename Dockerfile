# Build + runtime image for Panorámica intranet.
# Multi-stage: deps cached separately, build runs in slim layer, runtime only ships
# what's needed (incluyendo libs de Chromium para que @sparticuz/chromium imprima PDFs).
# Railway picks Dockerfile over nixpacks.toml automatically when present.

# ---------- Stage 1: deps (cacheable) ----------
FROM node:20-bookworm-slim AS deps

WORKDIR /app

# Install only deps. This layer is cached unless package.json or lock changes.
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --prefer-offline --no-audit --no-fund

# ---------- Stage 2: build ----------
FROM node:20-bookworm-slim AS build

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# vite + esbuild
RUN npm run build

# ---------- Stage 3: runtime ----------
FROM node:20-bookworm-slim AS runtime

# Chrome/Chromium runtime libraries (everything @sparticuz/chromium binary needs).
# Source: https://pptr.dev/troubleshooting#running-puppeteer-on-aws-lambda
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
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy production artifacts only
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
# Drizzle/migrations need these at runtime
COPY --from=build /app/shared ./shared
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 8080

# Run migrations on start, then serve.
CMD ["sh", "-c", "npm run db:push && npm start"]
