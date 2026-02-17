FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY parsers/ ./parsers/
COPY server/ ./server/
COPY templates/ ./templates/
COPY tsconfig.json ./

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
