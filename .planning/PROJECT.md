# SOAP Batch System

## What This Is
Automated SOAP note generation and MDLand submission for acupuncture clinics. Generates clinically accurate notes from patient data, with batch processing and browser automation.

## Core Value
Batch-generate compliant SOAP notes from minimal input, eliminating manual documentation.

## Current State
Shipped v1.0 Production Hardening. 25,914 LOC TypeScript.
Tech stack: Express 5, Vue 3, Playwright, ExcelJS, Docker Compose on Oracle Cloud.
Domain: https://rbmeds.com/ac/ (branch: clean-release)

## Requirements

### Validated
- ✓ JWT + API key auth, CORS, rate limiting — v1.0
- ✓ ExcelJS migration, cookie encryption, non-root Docker — v1.0
- ✓ DATA_DIR + LRU batch store, TS 0 errors, healthchecks — v1.0
- ✓ Excel magic bytes validation, CSRF protection — v1.0
- ✓ Env startup validation, type-safe pain parser — v1.0

### Active
- [ ] Automation retry/recovery on per-visit failures
- [ ] Structured error reporting with step-level detail
- [ ] Adaptive timeouts and network resilience

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

## Constraints
- Single server deployment (Oracle Cloud)
- No database — file-based storage only
- Playwright required for MDLand automation

---
*Last updated: 2026-02-22 after v1.1 milestone start*
