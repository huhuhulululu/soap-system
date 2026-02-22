# Technology Stack

**Analysis Date:** 2026-02-22

## Languages

**Primary:**
- TypeScript 5.3.3 - Backend (server, parsers, scripts), frontend, shared utilities
- JavaScript - Build tooling, configuration

**Secondary:**
- HTML/CSS - Frontend templates (Tailwind CSS)

## Runtime

**Environment:**
- Node.js (version not pinned, inferred from package.json compatibility)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Express 5.2.1 - REST API server (`server/index.ts`)
- Vue 3.4.0 - Frontend UI framework
- Vite 5.0.0 - Frontend build tool and dev server

**Testing:**
- Jest 29.7.0 - Unit and integration tests (configured in `package.json`)
- ts-jest 29.4.6 - TypeScript support for Jest
- Vitest 4.0.18 - Alternative test runner (frontend)
- @vue/test-utils 2.4.6 - Vue component testing

**Build/Dev:**
- tsx 4.21.0 - TypeScript execution for scripts
- TypeScript 5.3.3 - Compilation and type checking

## Key Dependencies

**Critical:**
- exceljs 4.4.0 - Excel file parsing and generation (`server/services/excel-parser.ts`)
- jsonwebtoken 9.0.3 - JWT authentication (`server/index.ts`)
- express-rate-limit 8.2.1 - Rate limiting middleware (`server/index.ts`)
- playwright 1.58.2 - Browser automation for MDLand scraping (`scripts/playwright/`, `server/services/automation-runner.ts`)

**Infrastructure:**
- cors 2.8.6 - CORS middleware
- cookie-parser 1.4.7 - Cookie parsing and encryption
- multer 2.0.2 - File upload handling
- pinia 2.1.7 - Vue state management
- vue-router 4.6.4 - Frontend routing
- apexcharts 5.3.6 - Chart visualization
- pdfjs-dist 4.10.38 - PDF rendering
- @vueuse/core 10.7.0 - Vue composition utilities

**Development:**
- Tailwind CSS 3.4.0 - Utility-first CSS framework
- PostCSS 8.4.32 - CSS processing
- Autoprefixer 10.4.16 - CSS vendor prefixing
- happy-dom 20.5.3 - DOM implementation for testing

## Configuration

**Environment:**
- Configured via environment variables (see `docker-compose.yml`)
- Key configs: `PORT`, `NODE_ENV`, `DATA_DIR`, `CORS_ORIGIN`
- Secrets: `COOKIE_ENCRYPTION_KEY`, `SHARED_JWT_SECRET`, `API_KEY` (loaded from `.env` on server)

**Build:**
- `tsconfig.json` - TypeScript compilation (ES2018 target, strict mode enabled)
- `vitest.config.ts` - Vitest configuration for frontend
- `frontend/vite.config.ts` - Vite configuration (inferred from package.json)

## Platform Requirements

**Development:**
- Node.js runtime
- npm package manager
- TypeScript compiler
- Playwright browsers (auto-installed, path: `/app/.playwright` in Docker)

**Production:**
- Docker containerization (multi-stage: frontend + backend)
- Nginx reverse proxy (strips `/ac/` prefix, forwards to Docker 9090:8080)
- Persistent volume: `batch-data` for batch storage and encrypted cookies
- Deployment target: Ubuntu server at `150.136.150.184` (from MEMORY.md)

---

*Stack analysis: 2026-02-22*
