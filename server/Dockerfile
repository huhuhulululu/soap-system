FROM node:20-slim

# Playwright system deps + Python for Vertex AI bridge
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 libxfixes3 \
    fonts-noto-cjk \
    python3 python3-pip \
    && pip3 install --no-cache-dir --break-system-packages google-genai \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright

WORKDIR /app

# Dependencies first (layer cache)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Playwright browser
RUN npx playwright install chromium

# Create non-root user before copying source
RUN addgroup --system appgroup \
    && adduser --system --ingroup appgroup appuser \
    && mkdir -p /app/data /app/data/screenshots \
    && chown -R appuser:appgroup /app/data

# Source code
COPY src/ ./src/
COPY parsers/ ./parsers/
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY templates/ ./templates/
COPY tsconfig.json ./

# Entrypoint (already in server/ but needs to be at /app root with +x)
RUN cp server/entrypoint.sh /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

EXPOSE 3001

ENTRYPOINT ["/app/entrypoint.sh"]
