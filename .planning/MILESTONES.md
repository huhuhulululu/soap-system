# Milestones

## v1.0 Production Hardening (Shipped: 2026-02-22)

**Phases:** 4 phases, 2 GSD plans + 3 pre-GSD phases
**Timeline:** 2026-02-10 → 2026-02-22 (12 days)
**Codebase:** 25,914 LOC TypeScript

**Key accomplishments:**
- JWT + API key auth with CORS lock and rate limiting
- xlsx→exceljs migration, cookie encryption, non-root Docker
- DATA_DIR + LRU batch store, TS 0 errors, healthchecks, lazy routes
- Magic bytes Excel validation (5MB limit), CSRF double-submit cookie
- Production env fail-fast validation, type-safe pain parser, auditor nullish coalescing

**Known gaps (fixed post-audit):**
- SEC-2 frontend CSRF header — fixed in commit 3596b81, deployed

**Archives:** `milestones/v1.0-ROADMAP.md`, `milestones/v1.0-REQUIREMENTS.md`, `milestones/v1.0-MILESTONE-AUDIT.md`

---


## v1.1 Automation Stability (Shipped: 2026-02-22)

**Phases:** 4 phases, 5 plans
**Timeline:** 2026-02-22 (1 day)
**Codebase:** +1,987 lines across 20 files

**Key accomplishments:**
- Error classification system with 6 error kinds (`classifyError`, `isPermanentError`) and step-level failure tracking
- Operation-specific timeout constants (10 named values) replacing global 30s default, with `TIMEOUT_MULTIPLIER` env var
- Automatic retry with exponential backoff (2s/4s) and full waiting-room re-navigation between attempts
- Structured NDJSON event emission (visit_start, visit_result, batch_summary) with parent-process JSON parsing
- Pre-batch session expiry event emission fix + 16 unit tests verifying error classification

**Tech debt:**
- Phase 5 missing VERIFICATION.md (requirements gap-closed in Phase 8)
- Idle API response missing `events` field (automate.ts:136)
- 4 pre-existing test failures in api-routes.test.ts (outside v1.1 scope)

**Archives:** `milestones/v1.1-ROADMAP.md`, `milestones/v1.1-REQUIREMENTS.md`, `milestones/v1.1-MILESTONE-AUDIT.md`

---

## v1.2 Batch Logic (Shipped: 2026-02-22)

**Phases:** 1 phase, 1 plan
**Timeline:** 2026-02-22 (1 day)
**Scope:** Phase 9 only (Phase 10 Form UX deferred)

**Key accomplishments:**
- `parseIncludeIE` default fix: soap-only defaults IE to true, only continue defaults to false
- Mode-aware IE CPT: full mode appends 99203 for HF/VC via `getDefaultIECPT`, soap-only strips it
- 9 new unit tests covering mode×insurance×CPT combinations (26/26 pass)

**Deferred to next milestone:**
- UX-01~04: Name/DOB split, Gender/Side toggle tags, form layout

**Archives:** `milestones/v1.2-ROADMAP.md`, `milestones/v1.2-REQUIREMENTS.md`

---


## v1.3 Form UX & Shared Data (Shipped: 2026-02-23)

**Phases:** 2 phases, 3 plans, 4 tasks
**Timeline:** 2026-02-22 → 2026-02-23
**Codebase:** ~32,000 LOC TypeScript

**Key accomplishments:**
- ICD/CPT data unified under src/shared/ — single source of truth (66 entries vs previous inline copies)
- Name/DOB split inputs with 4-format DOB auto-normalization on blur
- Gender/Side segmented button controls replacing dropdowns
- 12-column compact form layout with proportional column spans
- Blur-triggered inline validation with submit guard and first-error navigation

**Archives:** `milestones/v1.3-ROADMAP.md`, `milestones/v1.3-REQUIREMENTS.md`, `milestones/v1.3-MILESTONE-AUDIT.md`

---


## v1.4 UX & Engine Tuning (Shipped: 2026-02-23)

**Phases:** 1 phase (Phase 12), 3 plans, 6 tasks
**Scope:** Phase 12 only (Phases 13-15 deferred to v1.5)
**Timeline:** 2026-02-22 → 2026-02-23
**Codebase:** 35,157 LOC TypeScript
**Git range:** 4cf0a5d → f6ab203 (9 commits, 15 files, +20,459/-141 lines)

**Key accomplishments:**
- 30 deterministic SOAP engine snapshot tests + Strength/ROM audit report (7/7 parity across compose and batch)
- normalizeGenerationContext() shared function unifying batch and compose context construction
- 9 parity diff tests proving batch/compose produce byte-identical SOAP output across all 7 body parts
- 39/39 tests green, 0 type errors — full regression safety net for future engine modifications

**Known gaps (deferred to v1.5):**
- UX-01, UX-02, UX-03: Batch Form UX (Phase 15)
- CRV-01, CRV-02: Recovery Curve & Goals Calibration (Phase 13)
- ASS-01, ASS-02, ASS-03: Assessment Reflection (Phase 14)

**Archives:** `milestones/v1.4-ROADMAP.md`, `milestones/v1.4-REQUIREMENTS.md`

---

