# Project State

## Status
v1.5 Engine & UX Completion — Phase 13 in progress

## Project Reference
See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Batch-generate compliant SOAP notes from minimal input
**Current focus:** v1.5 — Phase 13 Recovery Curve & Goals Calibration

## Current Position
Phase: 13-recovery-curve-goals-calibration
Plan: 03 (next)
Status: In progress (2/3 plans complete)
Last activity: 2026-02-23 — Completed 13-02 (chronic dampener on engine progress curve)

## Performance Metrics
- v1.0: 4 phases complete (Production Hardening)
- v1.1: 4 phases, 5 plans complete (Automation Stability)
- v1.2: 1 phase, 1 plan complete (Batch Logic)
- v1.3: 2 phases, 3 plans complete (Form UX & Shared Data)
- v1.4: 1 phase, 3 plans complete (UX & Engine Tuning — scoped to Phase 12)
- v1.5: Phase 13 plans 01-02 complete (6 min total)

## Accumulated Context

### Critical Constraints
- MDLand is non-idempotent: ICD/CPT codes are appended, not replaced
- Session-expired errors must stop the batch (ERR-03), never retry
- Single server deployment (Oracle Cloud)
- tx-sequence-engine.ts (1,216 LOC) — any new rng() call shifts entire PRNG sequence; append new calls at end of loop
- 30 fixture snapshots must pass before any engine modification (Phases 13-14)

### Phase Dependencies (v1.5)
- Phase 13 (curve) before Phase 14 (assessment depends on stable curve)
- Phase 15 (batch UX) is independent — can run after Phase 12

### Blockers
None

## Decisions
- HIP not in SUPPORTED_TX_BODY_PARTS — replaced with SHOULDER-bilateral in fixtures
- Strength/ROM values identical between compose/batch (computed from pain+progress, not tightness/tenderness/spasm)
- Canonical tightness/tenderness/spasm formula: painCurrent >= 7 ? 3 : 2 (matches batch baseline)
- normalizeGenerationContext() is sole context-construction entry point for both batch and compose paths
- Parity seeds 200001-200009 distinct from fixture snapshot seeds 100001-100030
- CHRONIC_END_RATIO = 0.55 for chronic pain LT (30-50% improvement, not 75%)
- Chronic dampener threshold: txCount >= 16, factor 0.82 (pre-loop multiplicative)

## Session Continuity
- Branch: v1.1-ux
- Next action: Execute 13-03-PLAN.md (snapshot regeneration + parity verification)
- Last session: 2026-02-23 — Completed 13-02-PLAN.md
