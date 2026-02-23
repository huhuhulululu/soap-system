# Project State

## Status
v1.5 Engine & UX Completion — SHIPPED 2026-02-23

## Project Reference
See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Batch-generate compliant SOAP notes from minimal input
**Current focus:** v1.5 complete — all 11 requirements delivered

## Current Position
Milestone: v1.5 — Complete
Status: All 11 requirements shipped (CRV-01/02, ASS-01/02/03, UX-01/02/03, SEED-01, PLAT-01, GATE-01)
Last activity: 2026-02-23 — Completed GATE-01 (final v1.5 requirement)

## Performance Metrics
- v1.0: 4 phases complete (Production Hardening)
- v1.1: 4 phases, 5 plans complete (Automation Stability)
- v1.2: 1 phase, 1 plan complete (Batch Logic)
- v1.3: 2 phases, 3 plans complete (Form UX & Shared Data)
- v1.4: 1 phase, 3 plans complete (UX & Engine Tuning — scoped to Phase 12)
- v1.5: Phase 13 complete — 3 plans (Recovery Curve & Goals Calibration)
- v1.5: Phase 14 complete — 3 plans (Assessment Reflection)
- v1.5: Phase 15 complete — 1 plan (Batch Form UX)
- v1.5: SEED-01 complete — per-patient seed passthrough
- v1.5: PLAT-01 complete — plateau breaker for stalled pain
- v1.5: GATE-01 complete — Medicare visit 12 phase gate annotation

## Accumulated Context

### Critical Constraints
- MDLand is non-idempotent: ICD/CPT codes are appended, not replaced
- Session-expired errors must stop the batch (ERR-03), never retry
- Single server deployment (Oracle Cloud)
- tx-sequence-engine.ts (1,221 LOC) — any new rng() call shifts entire PRNG sequence; append new calls at end of loop
- 30 fixture snapshots must pass before any engine modification

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
- ASS-01: whatChanged evidence-based selection (frequency > ADL > objective > pain fallback)
- ASS-02: present/patientChange gated by cumulativePainDrop >= 3.0 + progress >= 0.5, OR visit-level painDelta >= 0.7
- ASS-03: ADL rotation options fixed to use TX_WHAT_CHANGED_OPTIONS values only
- UX-01: ICD dropdown shows all codes when bodyPart empty; selectIcd auto-fills bodyPart + laterality from catalog
- UX-02: Pain score selects use w-[60px] instead of w-full
- UX-03: ICD chips display inline to the right of search input (flex row)

- SEED-01: Batch API accepts optional seed per patient; response includes seeds; replay produces identical output
- PLAT-01: When pain label identical 3+ visits, micro-improvement (0.3-0.5 drop) injected to break plateau
- GATE-01: Visit 12 for Medicare (ELDERPLAN) annotated with NCD 30.3.3 cumulative improvement evidence

## Session Continuity
- Branch: clean-release
- Next action: v1.5 milestone audit or start v1.6 planning
- Last session: 2026-02-23 — Completed v1.5 milestone (all 11 requirements)
