# Build + runtime image for Panorámica intranet.
# Includes Chromium dependencies so @sparticuz/chromium / puppeteer-core can render PDFs.
# Railway picks Dockerfile over nixpacks.toml automatically when present.

FROM node:20-bookworm-slim AS base

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

# Install dependencies (with legacy peer deps as in nixpacks).
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy the rest and build.
COPY . .
RUN npm run build

# Skip Puppeteer Chromium download (we use @sparticuz/chromium).
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production

EXPOSE 8080

# Run migrations on start, then serve.
CMD ["sh", "-c", "npm run db:push && npm start"]
