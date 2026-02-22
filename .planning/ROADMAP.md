# Roadmap: SOAP Batch System

## Milestones

- ✅ **v1.0 Production Hardening** — Phases 1-4 (shipped 2026-02-22)
- ✅ **v1.1 Automation Stability** — Phases 5-8 (shipped 2026-02-22)
- 🔄 **v1.2 UX & Batch Logic** — Phases 9-10

## Phases

<details>
<summary>✅ v1.0 Production Hardening (Phases 1-4) — SHIPPED 2026-02-22</summary>

- [x] Phase 1: Auth & Access Control — JWT, CORS, rate limiting
- [x] Phase 2: Data Security — exceljs, cookie encryption, non-root Docker
- [x] Phase 3: Storage & Reliability — DATA_DIR + LRU, TS 0 errors, healthchecks
- [x] Phase 4: Security Hardening & Stability — magic bytes, CSRF, env validation, type-safety

</details>

<details>
<summary>✅ v1.1 Automation Stability (Phases 5-8) — SHIPPED 2026-02-22</summary>

- [x] Phase 5: Error Classification — shared types, 6 error kinds, step tracking
- [x] Phase 6: Adaptive Timeouts — 10 named timeout constants, TIMEOUT_MULTIPLIER
- [x] Phase 7: Retry, Recovery & Events — withRetry, emitEvent, fatal-stop, JSON parsing
- [x] Phase 8: Verification & Event Gap Closure — unit tests, pre-batch event fix

</details>

### v1.2 UX & Batch Logic (Phases 9-10)

- [ ] Phase 9: Batch Logic Fixes — IE/CPT logic across three modes
  **Requirements:** [BL-01, BL-02, BL-03]
  **Plans:** 1 plan
  Plans:
  - [ ] 09-01-PLAN.md — TDD: parseIncludeIE default fix + mode-aware IE CPT logic
- [ ] Phase 10: Form UX Optimization — name/DOB split, toggle tags, layout

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4   | v1.0      | 5/5            | Complete | 2026-02-22 |
| 5. Error Classification | v1.1 | 1/1 | Complete | 2026-02-22 |
| 6. Adaptive Timeouts | v1.1 | 1/1 | Complete | 2026-02-22 |
| 7. Retry, Recovery & Events | v1.1 | 2/2 | Complete | 2026-02-22 |
| 8. Verification & Event Gap Closure | v1.1 | 1/1 | Complete | 2026-02-22 |
| 9. Batch Logic Fixes | v1.2 | 0/1 | Planning | — |
| 10. Form UX Optimization | v1.2 | 0/0 | Pending | — |
