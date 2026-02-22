# Roadmap: SOAP Batch System

## Milestones

- ✅ **v1.0 Production Hardening** — Phases 1-4 (shipped 2026-02-22)
- ✅ **v1.1 Automation Stability** — Phases 5-8 (shipped 2026-02-22)
- ✅ **v1.2 Batch Logic** — Phase 9 (shipped 2026-02-22)
- 🔄 **v1.3 Form UX & Shared Data** — Phases 10-11

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

### v1.3 Form UX & Shared Data (Phases 10-11)

- [ ] Phase 10: Shared Data Extraction — ICD/CPT 提取到前端共享模块
  **Requirements:** [DATA-01, DATA-02]
- [ ] Phase 11: Form UX & Validation — Name/DOB split, toggle tags, layout, validation
  **Requirements:** [UX-01, UX-02, UX-03, UX-04, VAL-01]

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-4   | v1.0      | 5/5            | Complete | 2026-02-22 |
| 5. Error Classification | v1.1 | 1/1 | Complete | 2026-02-22 |
| 6. Adaptive Timeouts | v1.1 | 1/1 | Complete | 2026-02-22 |
| 7. Retry, Recovery & Events | v1.1 | 2/2 | Complete | 2026-02-22 |
| 8. Verification & Event Gap Closure | v1.1 | 1/1 | Complete | 2026-02-22 |
| 9. Batch Logic Fixes | v1.2 | 1/1 | Complete | 2026-02-22 |
| 10. Shared Data Extraction | v1.3 | 0/0 | Pending | — |
| 11. Form UX & Validation | v1.3 | 0/0 | Pending | — |
