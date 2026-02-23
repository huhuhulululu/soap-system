# SOAP Batch System

## What This Is
Automated SOAP note generation and MDLand submission for acupuncture clinics. Generates clinically accurate notes from patient data, with batch processing and browser automation. Batch and compose paths now produce identical output through a shared normalization layer.

## Core Value
Batch-generate compliant SOAP notes from minimal input, eliminating manual documentation.

## Current State
Shipped v1.4 UX & Engine Tuning. 35,157 LOC TypeScript.
Tech stack: Express 5, Vue 3, Playwright, ExcelJS, Vitest, Docker Compose on Oracle Cloud.
Domain: https://rbmeds.com/ac/ (branch: clean-release)
39 regression tests (30 fixture snapshots + 9 parity diff) guard engine modifications.

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
- ✓ Soap-only IE default fix (includeIE=true for non-continue modes) — v1.2
- ✓ Mode-aware IE CPT logic (99203 only in full mode for HF/VC) — v1.2
- ✓ Name/DOB split inputs with 4-format DOB auto-normalization — v1.3
- ✓ Gender M/F segmented button control — v1.3
- ✓ Side L/B/R segmented button control — v1.3
- ✓ 12-column compact form layout — v1.3
- ✓ ICD/CPT catalog extracted to src/shared/ — v1.3
- ✓ Inline validation with blur triggers and submit guard — v1.3
- ✓ 30 fixture snapshots for SOAP engine regression baseline — v1.4
- ✓ Strength/ROM audit: 7/7 parity across compose, batch, realistic patch — v1.4
- ✓ normalizeGenerationContext() as sole entry point for both paths — v1.4
- ✓ Batch/compose parity: byte-identical output for same patient data — v1.4

### Active

#### Next Milestone: v1.5 Engine & UX Completion

- [ ] Recovery curve: 20-visit chronic-aware spread (CRV-01)
- [ ] Realistic long-term goals: 30-50% improvement for chronic (CRV-02)
- [ ] Assessment reflects specific improvements (ADL, pain, symptom) (ASS-01)
- [ ] Cumulative progress tracking for stronger assessment language (ASS-02)
- [ ] Assessment strictly within template structure (ASS-03)
- [ ] ICD-first selection with Body Part/Side auto-fill (UX-01)
- [ ] Pain score field width optimization (~60px) (UX-02)
- [ ] ICD chips displayed right-side of form row (UX-03)

### Out of Scope
- Database (PostgreSQL/Redis) — file-based approach works at current scale
- Mobile app — web-only for now
- Fuse.js fuzzy ICD search — 80 entries don't justify overhead
- LLM-generated assessment text — non-deterministic, compliance risk

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
| parseIncludeIE: continue=false, else=true | ✓ Good (soap-only needs IE for ICD validation) | v1.2 |
| IE CPT mode-split: full adds 99203, soap-only skips | ✓ Good (soap-only IE is structural, not billing) | v1.2 |
| ICDCatalogEntry adapter maps code→icd10, name→desc | ✓ Good (backend fields unchanged) | v1.3 |
| CPT helpers delegate to getDefaultTXCPT/getDefaultIECPT | ✓ Good (no data duplication) | v1.3 |
| No default gender/laterality on new patients | ✓ Good (forces explicit selection) | v1.3 |
| clearFieldError wired into updateField | ✓ Good (auto-clear on input) | v1.3 |
| HIP replaced with SHOULDER-bilateral in fixtures | ✓ Good (HIP not in SUPPORTED_TX_BODY_PARTS) | v1.4 |
| Canonical tightness formula: painCurrent >= 7 ? 3 : 2 | ✓ Good (matches batch baseline) | v1.4 |
| normalizeGenerationContext() as sole context entry point | ✓ Good (eliminates divergence by construction) | v1.4 |
| Parity seeds 200001-200009 distinct from fixture seeds | ✓ Good (no collision) | v1.4 |

## Constraints
- Single server deployment (Oracle Cloud)
- No database — file-based storage only
- Playwright required for MDLand automation
- tx-sequence-engine.ts: new rng() calls must append at end of loop (PRNG sequence sensitive)
- 30 fixture snapshots must pass before any engine modification

---
*Last updated: 2026-02-23 after v1.4 milestone*
