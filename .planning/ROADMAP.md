# Roadmap: SOAP Batch System

## Milestones

- ✅ **v1.0 Production Hardening** — Phases 1-4 (shipped 2026-02-22)
- ✅ **v1.1 Automation Stability** — Phases 5-8 (shipped 2026-02-22)
- ✅ **v1.2 Batch Logic** — Phase 9 (shipped 2026-02-22)
- ✅ **v1.3 Form UX & Shared Data** — Phases 10-11 (shipped 2026-02-23)
- ✅ **v1.4 UX & Engine Tuning** — Phase 12 (shipped 2026-02-23)
- 📋 **v1.5 Engine & UX Completion** — Phases 13-15 (planned)

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

<details>
<summary>✅ v1.2 Batch Logic (Phase 9) — SHIPPED 2026-02-22</summary>

- [x] Phase 9: Batch Logic Fixes — mode-aware IE/CPT logic (BL-01/02/03)

</details>

<details>
<summary>✅ v1.3 Form UX & Shared Data (Phases 10-11) — SHIPPED 2026-02-23</summary>

- [x] Phase 10: Shared Data Extraction — ICD/CPT unified under src/shared/
- [x] Phase 11: Form UX & Validation — Name/DOB split, segmented controls, inline validation

</details>

<details>
<summary>✅ v1.4 UX & Engine Tuning (Phase 12) — SHIPPED 2026-02-23</summary>

- [x] Phase 12: Fixture Snapshots & Parity Audit (3/3 plans) — 30 snapshots, normalizeGenerationContext(), parity diff tests

</details>

### 📋 v1.5 Engine & UX Completion (Planned)

- [ ] Phase 13: Recovery Curve & Goals Calibration (CRV-01, CRV-02)
- [ ] Phase 14: Assessment Reflection (ASS-01, ASS-02, ASS-03)
- [ ] Phase 15: Batch Form UX (UX-01, UX-02, UX-03)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4   | v1.0      | 5/5            | Complete | 2026-02-22 |
| 5. Error Classification | v1.1 | 1/1 | Complete | 2026-02-22 |
| 6. Adaptive Timeouts | v1.1 | 1/1 | Complete | 2026-02-22 |
| 7. Retry, Recovery & Events | v1.1 | 2/2 | Complete | 2026-02-22 |
| 8. Verification & Event Gap Closure | v1.1 | 1/1 | Complete | 2026-02-22 |
| 9. Batch Logic Fixes | v1.2 | 1/1 | Complete | 2026-02-22 |
| 10. Shared Data Extraction | v1.3 | 1/1 | Complete | 2026-02-22 |
| 11. Form UX & Validation | v1.3 | 2/2 | Complete | 2026-02-23 |
| 12. Fixture Snapshots & Parity Audit | v1.4 | 3/3 | Complete | 2026-02-23 |
| 13. Recovery Curve & Goals Calibration | v1.5 | 0/? | Not started | — |
| 14. Assessment Reflection | v1.5 | 0/? | Not started | — |
| 15. Batch Form UX | v1.5 | 0/? | Not started | — |
