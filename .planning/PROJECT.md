# SOAP Batch System

## What This Is
Automated SOAP note generation and MDLand submission for acupuncture clinics. Generates clinically accurate notes from patient data, with batch processing and browser automation.

## Core Value
Batch-generate compliant SOAP notes from minimal input, eliminating manual documentation.

## Current State
Shipped v1.1 Automation Stability. ~27,900 LOC TypeScript.
Tech stack: Express 5, Vue 3, Playwright, ExcelJS, Vitest, Docker Compose on Oracle Cloud.
Domain: https://rbmeds.com/ac/ (branch: clean-release)

## Requirements

### Validated
- ✓ JWT + API key auth, CORS, rate limiting — v1.0
- ✓ ExcelJS migration, cookie encryption, non-root Docker — v1.0
- ✓ DATA_DIR + LRU batch store, TS 0 errors, healthchecks — v1.0
- ✓ Excel magic bytes validation, CSRF protection — v1.0
- ✓ Env startup validation, type-safe pain parser — v1.0
- ✓ Error classification (6 kinds) + step-level failure tracking — v1.1
- ✓ Adaptive per-operation timeouts with TIMEOUT_MULTIPLIER — v1.1
- ✓ Automatic retry with backoff + waiting-room re-navigation — v1.1
- ✓ Structured NDJSON event emission + parent-process parsing — v1.1

### Active
(None — define in next milestone)

### Out of Scope
- Database (PostgreSQL/Redis) — file-based approach works at current scale
- Mobile app — web-only for now

## Key Decisions

| Decision | Outcome | Version |
|----------|---------|---------|
| Express 5 + Vue 3 + Playwright stack | ✓ Good | v1.0 |
| File-based storage with LRU cache | ✓ Good (at current scale) | v1.0 |
| Docker Compose on Oracle Cloud | ✓ Good | v1.0 |
| No CSRF exemption for API-key clients | ✓ Good (simpler security model) | v1.0 |
| Magic bytes in route handler not fileFilter | ✓ Good (buffer unavailable in fileFilter) | v1.0 |
| validateEnv in require.main only | ✓ Good (tests unaffected) | v1.0 |
| Error classification before retry logic | ✓ Good (isPermanentError gates withRetry) | v1.1 |
| Retry in child process not parent | ✓ Good (browser context lives there) | v1.1 |
| NDJSON on existing stdout pipe | ✓ Good (startsWith guard handles mixed output) | v1.1 |
| TIMEOUTS pre-scaled at module load | ✓ Good (no per-call multiplication) | v1.1 |
| unknown errorKind treated as retryable | ✓ Good (safer to retry than skip) | v1.1 |

## Constraints
- Single server deployment (Oracle Cloud)
- No database — file-based storage only
- Playwright required for MDLand automation

---
*Last updated: 2026-02-22 after v1.1 milestone complete*
