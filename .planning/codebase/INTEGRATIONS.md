# External Integrations

**Analysis Date:** 2026-02-22

## APIs & External Services

**MDLand Automation:**
- MDLand medical records system - Browser automation via Playwright
  - SDK/Client: `playwright` 1.58.2
  - Auth: Cookies stored encrypted in `DATA_DIR/mdland-storage-state.enc`
  - Implementation: `server/services/automation-runner.ts`, `scripts/playwright/mdland-automation.ts`
  - Encryption: AES-256-GCM with `COOKIE_ENCRYPTION_KEY` env var

**SOAP Generation:**
- Internal SOAP note generation engine (no external API)
  - Implementation: `src/parser/`, `server/services/batch-generator.ts`
  - Generates medical notes from patient data

## Data Storage

**Databases:**
- None - File-based storage only

**File Storage:**
- Local filesystem only
  - Batch data: `DATA_DIR/batches/` (JSON files, LRU cache max 50 items)
  - Encrypted cookies: `DATA_DIR/mdland-storage-state.enc`
  - Temp cookies: `DATA_DIR/.tmp-cookies.json` (cleaned up after automation)
  - Client: Node.js `fs` module

**Caching:**
- In-memory LRU cache (50 items max) + JSON file persistence
  - Implementation: `server/store/batch-store.ts`
  - No external cache service

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `server/index.ts` (requireAuth middleware)
  - Token source: `rbmeds_token` cookie (shared with PT system)
  - Secret: `SHARED_JWT_SECRET` env var
  - Fallback: `x-api-key` header for backward compatibility
  - Payload fields: `ac_access` (required), `username`, `role`

**Cookie Encryption:**
- AES-256-GCM encryption for MDLand storage state
  - Key: `COOKIE_ENCRYPTION_KEY` env var (hex-encoded)
  - Format: [IV 12B][Auth Tag 16B][Ciphertext]
  - Implementation: `server/services/automation-runner.ts`

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Console output (stdout/stderr)
- Automation logs: Captured in-memory (last 500 lines) in `AutomationJob.logs`
  - Implementation: `server/services/automation-runner.ts`
- Health check endpoint: `GET /api/health` (no auth required)

## CI/CD & Deployment

**Hosting:**
- Docker Compose (multi-container)
  - Frontend: Node.js + Vite dev server (port 8080 → 9090)
  - Backend: Node.js Express (port 3001, internal only)
  - Volumes: `batch-data` for persistence
  - Restart policy: `unless-stopped`

**CI Pipeline:**
- None detected (manual deployment via git pull + docker compose up)

**Deployment:**
- SSH-based: `ssh ubuntu@150.136.150.184 "cd /home/ubuntu/soap-system && git pull origin clean-release && docker compose up -d --build"`
- Branch: `clean-release`
- Domain: `https://rbmeds.com/ac/` (Nginx reverse proxy)

## Environment Configuration

**Required env vars:**
- `COOKIE_ENCRYPTION_KEY` - Hex-encoded AES-256 key for MDLand cookies
- `SHARED_JWT_SECRET` - JWT signing secret (shared with PT system)
- `API_KEY` - Fallback API key for x-api-key header auth
- `CORS_ORIGIN` - CORS allowed origin (default: `https://rbmeds.com`)
- `PORT` - Backend port (default: 3001)
- `NODE_ENV` - Environment (production in Docker)
- `DATA_DIR` - Batch data directory (default: `/app/data` in Docker, `.batch-data` locally)
- `PLAYWRIGHT_BROWSERS_PATH` - Playwright browser cache (default: `/app/.playwright`)

**Secrets location:**
- `.env` file on server (not committed, contains `COOKIE_ENCRYPTION_KEY`, `SHARED_JWT_SECRET`)
- Loaded at runtime via `process.env`

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## File Upload & Processing

**Excel Import:**
- Multer 2.0.2 for file upload handling
- ExcelJS 4.4.0 for parsing
- Supports horizontal (row 1 = headers) and vertical (col A = fields) layouts
- Endpoint: `POST /api/batch/upload` (requires auth)
- Implementation: `server/routes/batch.ts`, `server/services/excel-parser.ts`

## Batch Processing

**Batch Generation:**
- In-memory + file-based batch storage
- Modes: `full` (IE + TX visits), `soap-only` (SOAP text only), `continue` (extract from existing SOAP)
- Automation runner: Spawns child process with Playwright script
- Singleton lock: Only one automation can run at a time
- Implementation: `server/services/batch-generator.ts`, `server/services/automation-runner.ts`

---

*Integration audit: 2026-02-22*
