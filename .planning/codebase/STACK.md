# Technology Stack

**Analysis Date:** 2026-02-21

## Languages

**Primary:**
- TypeScript 5.3.3 - Backend (Node.js), frontend, parsers, scripts
- Vue 3.4.0 - Frontend UI framework
- HTML/CSS - Frontend templates (Tailwind CSS 3.4.0)

**Secondary:**
- JavaScript - Build tooling, configuration
- Shell - Docker entrypoints

## Runtime

**Environment:**
- Node.js 20 (slim image for backend, alpine for frontend builder)
- Browser: Chromium (via Playwright 1.58.2)

**Package Manager:**
- npm 10+ (inferred from Node 20)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Express 5.2.1 - REST API backend (`server/index.ts`)
- Vue 3.4.0 - Frontend SPA (`frontend/`)
- Vue Router 4.6.4 - Frontend routing

**Testing:**
- Jest 29.7.0 - Unit/integration tests (backend)
- Vitest 4.0.18 - Unit tests (frontend)
- ts-jest 29.4.6 - TypeScript support for Jest
- Playwright 1.58.2 - E2E automation and browser automation

**Build/Dev:**
- Vite 5.0.0 - Frontend bundler
- tsx 4.21.0 - TypeScript execution (scripts, automation)
- TypeScript 5.3.3 - Type checking

## Key Dependencies

**Critical:**
- exceljs 4.4.0 - Excel file parsing/generation (`server/services/excel-parser.ts`)
- jsonwebtoken 9.0.3 - JWT authentication (`server/index.ts`)
- express-rate-limit 8.2.1 - Rate limiting middleware
- cookie-parser 1.4.7 - Cookie parsing
- cors 2.8.6 - CORS middleware
- multer 2.0.2 - File upload handling

**Frontend UI:**
- pinia 2.1.7 - State management
- apexcharts 5.3.6 - Data visualization
- vue3-apexcharts 1.10.0 - Vue wrapper for ApexCharts
- pdfjs-dist 4.10.38 - PDF rendering
- @vueuse/core 10.7.0 - Vue composition utilities

**Styling:**
- Tailwind CSS 3.4.0 - Utility-first CSS
- PostCSS 8.4.32 - CSS processing
- Autoprefixer 10.4.16 - Browser prefix support

**Development:**
- @types/express 5.0.6 - Express type definitions
- @types/node 20.11.0 - Node.js type definitions
- @types/jest 29.5.14 - Jest type definitions
- @types/cookie-parser 1.4.10 - Cookie parser types
- @types/jsonwebtoken 9.0.10 - JWT types
- @types/multer 2.0.0 - Multer types
- @types/cors 2.8.19 - CORS types

## Configuration

**Environment:**
- `.env.example` defines required vars: `API_KEY`, `COOKIE_ENCRYPTION_KEY`, `SHARED_JWT_SECRET`
- `docker-compose.yml` sets: `PORT=3001`, `NODE_ENV=production`, `DATA_DIR=/app/data`, `CORS_ORIGIN=https://rbmeds.com`
- Backend reads from environment at runtime (`server/index.ts` lines 21, 39, 59)

**Build:**
- `tsconfig.json` - TypeScript compilation (ES2018 target, strict mode, source maps)
- `vitest.config.ts` - Frontend test configuration
- `jest` config in `package.json` - Backend test configuration
- Frontend: `vite.config.ts` (inferred from Vite usage)

## Platform Requirements

**Development:**
- Node.js 20+
- npm 10+
- Docker (for containerized deployment)

**Production:**
- Docker container (backend: `node:20-slim`, frontend: `nginx:alpine`)
- Persistent volume: `batch-data:/app/data` for batch storage and encrypted cookies
- Port 3001 (backend), 8080 (frontend via Nginx)
- Environment variables: `API_KEY`, `COOKIE_ENCRYPTION_KEY`, `SHARED_JWT_SECRET`, `CORS_ORIGIN`

## Deployment

**Containerization:**
- Backend: `server/Dockerfile` - Node 20 slim, Playwright Chromium, non-root user
- Frontend: `frontend/Dockerfile` - Multi-stage build (Node 20 alpine → Nginx alpine)
- Orchestration: `docker-compose.yml` - Two services (frontend, backend) with volume sharing

**Health Checks:**
- Backend: HTTP GET `/api/health` (127.0.0.1:3001)
- Frontend: HTTP GET / (127.0.0.1:8080)

---

*Stack analysis: 2026-02-21*
