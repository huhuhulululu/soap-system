FROM node:20-slim

# Playwright system deps for Chromium (headless)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 libxfixes3 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Install Chromium browser for Playwright
RUN npx playwright install chromium

COPY src/ ./src/
COPY parsers/ ./parsers/
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY templates/ ./templates/
COPY tsconfig.json ./

RUN mkdir -p /app/data /app/data/screenshots

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
