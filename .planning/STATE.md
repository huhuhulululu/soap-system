# Project State

## Status
v1.4 UX & Engine Tuning — Phase 12 complete

## Project Reference
See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Batch-generate compliant SOAP notes from minimal input
**Current focus:** Phase 12 — Fixture Snapshots & Parity Audit

## Current Position
Phase: 12 — Fixture Snapshots & Parity Audit — Complete
Plan: 03 — Complete (final plan)
Status: Phase 12 complete — 39/39 tests green (30 snapshots + 9 parity), 0 type errors
Last activity: 2026-02-23 — Parity diff tests added, full regression green

## Performance Metrics
- v1.0: 4 phases complete (Production Hardening)
- v1.1: 4 phases, 5 plans complete (Automation Stability)
- v1.2: 1 phase, 1 plan complete (Batch Logic)
- v1.3: 2 phases, 3 plans complete (Form UX & Shared Data)
- v1.4: 1/4 phases, 3 plans complete (UX & Engine Tuning)

## Accumulated Context

### Critical Constraints
- MDLand is non-idempotent: ICD/CPT codes are appended, not replaced
- Session-expired errors must stop the batch (ERR-03), never retry
- Single server deployment (Oracle Cloud)
- BatchView.vue is 1,697 lines — primary refactor target
- tx-sequence-engine.ts (1,216 LOC) — any new rng() call shifts entire PRNG sequence; append new calls at end of loop
- Fixture snapshots (Phase 12) must be captured before any engine modification (Phases 13-14)

### Phase Dependencies
- Phase 12 (audit + fixtures) before Phases 13-14 (engine changes)
- Phase 13 (curve) before Phase 14 (assessment depends on stable curve)
- Phase 15 (batch UX) is independent — can run after Phase 12

### Blockers
None

## Decisions
- HIP not in SUPPORTED_TX_BODY_PARTS — replaced with SHOULDER-bilateral in fixtures
- Strength/ROM values identical between compose/batch (computed from pain+progress, not tightness/tenderness/spasm)
- Known parity gaps (tightness/tenderness/spasm initialState, TCM inference) affect Muscle Testing only
- Canonical tightness/tenderness/spasm formula: painCurrent >= 7 ? 3 : 2 (matches batch baseline, not engine severityToInit)
- normalizeGenerationContext() is sole context-construction entry point for both batch and compose paths
- Parity seeds 200001-200009 distinct from fixture snapshot seeds 100001-100030

## Session Continuity
- Branch: v1.1-ux
- Next action: Phase 12 complete — proceed to Phase 13 (Recovery Curve & Goals Calibration)
- Last session: 2026-02-23 — Phase 12 Plan 03 executed (parity diff tests)
