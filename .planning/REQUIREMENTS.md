# Requirements: SOAP Batch System

**Defined:** 2026-02-22
**Core Value:** Batch-generate compliant SOAP notes from minimal input

## v1.1 Requirements

### Error Handling

- [ ] **ERR-01**: Automation classifies errors as transient (timeout, element not found) or permanent (session expired, patient not found)
- [ ] **ERR-02**: Failed visits report which step failed (e.g., fillSOAP, addICD, checkout) in VisitResult
- [ ] **ERR-03**: Session expiry stops the entire batch immediately instead of retrying remaining visits

### Retry & Recovery

- [ ] **RET-01**: Failed visits automatically retry up to 2 times with exponential backoff (2s/4s delay)
- [ ] **RET-02**: Each retry closes the current visit and re-navigates from waiting room before re-attempting

### Timeouts

- [ ] **TMO-01**: Each automation step uses operation-specific timeout instead of global 30s default

### Observability

- [ ] **OBS-01**: Child process emits structured JSON line events on stdout for visit start, result, and batch summary

## Future Requirements

### Crash Recovery (v1.2+)

- **REC-01**: Progress file persisted after each visit for crash recovery
- **REC-02**: Re-run skips already-completed visits

### Idempotency (v1.2+)

- **IDP-01**: Read existing ICD/CPT codes before adding to prevent duplicates on retry

## Out of Scope

| Feature | Reason |
|---------|--------|
| Parallel visit processing | MDLand uses single-session iframe navigation |
| Circuit breaker pattern | Single-server, single-automation — no benefit |
| pino structured logging | Console.log + JSON lines sufficient for v1.1 |
| Frontend progress UI | Backend events only; frontend display deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ERR-01 | Phase 5 | Pending |
| ERR-02 | Phase 5 | Pending |
| ERR-03 | Phase 7 | Pending |
| RET-01 | Phase 7 | Pending |
| RET-02 | Phase 7 | Pending |
| TMO-01 | Phase 6 | Pending |
| OBS-01 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after roadmap creation*
