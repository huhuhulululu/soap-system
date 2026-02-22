# External Integrations

**Analysis Date:** 2026-02-21

## APIs & External Services

**MDLand Medical Records System:**
- Service: MDLand (medical records platform)
- What it's used for: Automated data extraction and form filling via Playwright
- SDK/Client: Playwright 1.58.2 (headless browser automation)
- Auth: Cookie-based (encrypted storage state)
- Implementation: `scripts/playwright/mdland-automation.ts`, `server/services/automation-runner.ts`

**Internal SOAP API:**
- Service: SOAP batch generation API (self-hosted)
- What it's used for: Batch processing of medical notes
- Endpoints: `/api/batch/*`, `/api/automate/*`
- Auth: JWT token (`rbmeds_token` cookie) or `x-api-key` header

## Data Storage

**Databases:**
- Type: File-based (no traditional database)
- Storage: Local filesystem at `DATA_DIR` (default `/app/data`)
- Client: Node.js `fs` module
- Implementation: `server/store/batch-store.ts`

**File Storage:**
- Local filesystem only
- Batch data: `DATA_DIR/batches/` (JSON files)
- Encrypted cookies: `DATA_DIR/mdland-storage-state.enc` (AES-256-GCM encrypted)
- Screenshots: `DATA_DIR/screenshots/` (from Playwright automation)
- Temp files: `DATA_DIR/.tmp-cookies.json` (cleaned up after automation)

**Caching:**
- LRU cache for batch data (in-memory)
- Implementation: `server/store/batch-store.ts` (batch store with LRU eviction)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based
- Implementation: `server/index.ts` (lines 17-50)

**Auth Flow:**
1. Primary: JWT token in `rbmeds_token` cookie (shared with PT system)
   - Verified against `SHARED_JWT_SECRET` env var
   - Requires `ac_access` claim for AC system access
2. Fallback: `x-api-key` header (backward compatible)
   - Compared against `API_KEY` env var
3. Public endpoints: `/api/health`, `/api/auth/me` (no auth required)

**Cookie Encryption:**
- Algorithm: AES-256-GCM
- Key: `COOKIE_ENCRYPTION_KEY` env var (hex-encoded)
- Format: [IV 12B][Auth Tag 16B][Ciphertext]
- Implementation: `server/services/automation-runner.ts` (lines 32-54)

## Monitoring & Observability

**Error Tracking:**
- Not detected

**Logs:**
- Console output (stdout/stderr)
- Automation logs: Captured in memory (last 500 lines) in `AutomationJob.logs`
- Implementation: `server/services/automation-runner.ts` (lines 198-206)

**Health Checks:**
- Backend: GET `/api/health` → `{ status: 'ok', timestamp: ISO8601 }`
- Frontend: HTTP GET / (Nginx)
- Docker health checks: 30s interval, 5s timeout, 3 retries

## CI/CD & Deployment

**Hosting:**
- Docker Compose (local/self-hosted)
- Production: Ubuntu server at `150.136.150.184` (from MEMORY.md)
- Domain: `https://rbmeds.com/ac/` (Nginx strips `/ac/` → Docker 9090:8080)

**CI Pipeline:**
- Not detected (no GitHub Actions, GitLab CI, etc.)

**Deployment Process:**
```bash
ssh ubuntu@150.136.150.184 "cd /home/ubuntu/soap-system && git pull origin clean-release && docker compose up -d --build"
```

## Environment Configuration

**Required env vars:**
- `API_KEY` - API key for x-api-key fallback auth
- `COOKIE_ENCRYPTION_KEY` - Hex-encoded AES-256-GCM key for cookie encryption
- `SHARED_JWT_SECRET` - JWT secret for token verification
- `CORS_ORIGIN` - CORS allowed origin (default: `http://localhost:9090`, production: `https://rbmeds.com`)
- `PORT` - Backend port (default: 3001)
- `NODE_ENV` - Environment (production/development)
- `DATA_DIR` - Batch data directory (default: `/app/data`)
- `PLAYWRIGHT_BROWSERS_PATH` - Playwright browser cache (default: `/app/.playwright`)

**Secrets location:**
- `.env` file on server (not committed)
- Docker Compose environment variables (from `.env` file)
- Values: `COOKIE_ENCRYPTION_KEY`, `SHARED_JWT_SECRET` (from MEMORY.md)

## Webhooks & Callbacks

**Incoming:**
- Not detected

**Outgoing:**
- Not detected

## Rate Limiting

**API Rate Limits:**
- General API: 60 requests per 60 seconds (window)
- Login endpoint: 5 requests per 15 minutes
- Implementation: `server/index.ts` (lines 68-72)

---

*Integration audit: 2026-02-21*
