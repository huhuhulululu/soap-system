# Roadmap: SOAP Batch System

## Milestones

- ✅ **v1.0 Production Hardening** — Phases 1-4 (shipped 2026-02-22)
- **v1.1 Automation Stability** — Phases 5-7 (active)

## Phases

<details>
<summary>✅ v1.0 Production Hardening (Phases 1-4) — SHIPPED 2026-02-22</summary>

- [x] Phase 1: Auth & Access Control — JWT, CORS, rate limiting
- [x] Phase 2: Data Security — exceljs, cookie encryption, non-root Docker
- [x] Phase 3: Storage & Reliability — DATA_DIR + LRU, TS 0 errors, healthchecks
- [x] Phase 4: Security Hardening & Stability — magic bytes, CSRF, env validation, type-safety

</details>

### v1.1 Automation Stability

- [x] **Phase 5: Error Classification** - Shared types and error kind enum that gate all retry logic
- [x] **Phase 6: Adaptive Timeouts** - Per-operation timeout constants replacing the global 30s default (completed 2026-02-22)
- [ ] **Phase 7: Retry, Recovery & Events** - Per-visit retry with backoff, session fast-fail, and JSON line events

## Phase Details

### Phase 5: Error Classification
**Goal**: The automation can distinguish permanent failures from transient ones, and reports which step failed
**Depends on**: Nothing (foundation for phases 6 and 7)
**Requirements**: ERR-01, ERR-02
**Success Criteria** (what must be TRUE):
  1. A failed visit result includes the name of the step that failed (e.g., "fillSOAP", "addICD", "checkout")
  2. Each automation error is classified as transient (timeout, element not found) or permanent (session expired, patient not found)
  3. The `isPermanentError()` guard returns true for session-expired errors and false for timeout errors
**Plans:** 1 plan
Plans:
- [x] 05-01-PLAN.md — Shared error types + step tracking in processVisit

### Phase 6: Adaptive Timeouts
**Goal**: Each automation step uses a timeout calibrated to its actual operation, not a global default
**Depends on**: Phase 5
**Requirements**: TMO-01
**Success Criteria** (what must be TRUE):
  1. Fast operations (clicks, navigation) use short timeouts; slow operations (TinyMCE init, SOAP save) use longer timeouts
  2. A timeout on one step does not cause unrelated steps to fail due to an inflated global timeout
  3. Timeout constants are defined in one place and referenced by name throughout the automation
**Plans:** 1/1 plans complete
Plans:
- [ ] 06-01-PLAN.md — Adaptive timeout constants + TIMEOUT_MULTIPLIER

### Phase 7: Retry, Recovery & Events
**Goal**: Failed visits automatically retry with clean state, session expiry stops the batch immediately, and every visit outcome is emitted as a structured event
**Depends on**: Phase 5, Phase 6
**Requirements**: RET-01, RET-02, ERR-03, OBS-01
**Success Criteria** (what must be TRUE):
  1. A visit that fails due to a transient error is retried up to 2 times with 2s then 4s delays before being marked failed
  2. Each retry closes the current visit and re-navigates from the waiting room before re-attempting
  3. A session-expired error stops the entire batch immediately without attempting remaining visits
  4. The child process emits a JSON line to stdout for visit start, visit result (pass/fail/attempts), and batch summary
**Plans:** 2 plans
Plans:
- [ ] 07-01-PLAN.md — Types + withRetry + emitEvent + fatal-stop in child process
- [ ] 07-02-PLAN.md — Parent process JSON event parsing

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Error Classification | 1/1 | Complete | 2026-02-22 |
| 6. Adaptive Timeouts | 1/1 | Complete    | 2026-02-22 |
| 7. Retry, Recovery & Events | 0/2 | Planned | - |
