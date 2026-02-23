# Roadmap: SOAP Batch System

## Milestones

- ✅ **v1.0 Production Hardening** — Phases 1-4 (shipped 2026-02-22)
- ✅ **v1.1 Automation Stability** — Phases 5-8 (shipped 2026-02-22)
- ✅ **v1.2 Batch Logic** — Phase 9 (shipped 2026-02-22)
- ✅ **v1.3 Form UX & Shared Data** — Phases 10-11 (shipped 2026-02-23)
- 🔄 **v1.4 UX & Engine Tuning** — Phases 12-15

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

<details open>
<summary>🔄 v1.4 UX & Engine Tuning (Phases 12-15)</summary>

### Phase 12: Fixture Snapshots & Parity Audit
**Requirements:** AUD-02, AUD-01, PAR-01, PAR-02
**Plans:** 3/3 plans complete

Plans:
- [x] 12-01-PLAN.md — Capture 30 fixture snapshots + Strength/ROM audit report
- [x] 12-02-PLAN.md — Build normalizeGenerationContext() + refactor both paths
- [x] 12-03-PLAN.md — Parity diff tests proving identical batch/compose output

Pre-work phase. Captures regression baselines before any engine modification and establishes batch/compose parity through a shared normalization layer.

**Delivers:**
- 30 reference seed fixture snapshots in `src/generator/__fixtures__/`
- Strength/ROM generation audit report across compose, batch, and realistic patch modes
- `normalizeGenerationContext()` shared function standardizing input for both generation paths
- Parity diff test proving identical output from batch and compose for same patient data

**Success criteria:**
1. Running `vitest` against fixture snapshots produces 30/30 green for current engine output
2. Strength/ROM values for the same seed+bodyPart are identical across compose mode, batch mode, and realistic patch
3. Same patient JSON fed through batch and compose paths produces byte-identical SOAP output
4. `normalizeGenerationContext()` is the sole entry point for both `batch-generator.ts` and compose generation

---

### Phase 13: Recovery Curve & Goals Calibration
**Requirements:** CRV-01, CRV-02

Highest-risk engine change. Recalibrates the recovery curve for 20-visit chronic pain courses and aligns long-term goals with realistic outcomes.

**Delivers:**
- Chronic-aware curve variant in `tx-sequence-engine.ts` (linear-blend for txCount >= 16, slower progression)
- `OPTIMAL_END_RATIO` scaled by visit count in `goals-calculator.ts` (30-50% improvement for chronic, not 75%)
- Strength/ROM ceiling logic preventing fully-normal values for chronic patients
- Reduced `NOISE_CAP` for longer plans to maintain monotonic constraint through `snapPainToGrid`

**Success criteria:**
1. 20-visit chronic plan (txCount >= 16) shows measurable improvement spread across all 20 visits — no flat plateau after visit 12
2. Long-term goals for chronic patients target 30-50% pain reduction (e.g., pain 8 -> LTG pain 4-5), never reaching 0-2
3. Strength/ROM at visit 20 for chronic patients stays below "normal" (e.g., 4+/5 not 5/5, WFL not full ROM)
4. All 30 fixture snapshots from Phase 12 still pass (engine changes append RNG calls, don't shift existing sequence)

---

### Phase 14: Assessment Reflection
**Requirements:** ASS-01, ASS-02, ASS-03

Extends the assessment section to reflect cumulative improvement with concrete deltas. Depends on stable curve behavior from Phase 13.

**Delivers:**
- `cumulativePainDelta` (IE -> current visit) passed to `deriveAssessmentFromSOA()`
- Specific improvement mentions (ADL, pain reduction, symptom change) when current visit shows measurable progress
- Stronger assessment language at later visits when cumulative delta >= 3
- All output strictly within existing template structure — no out-of-template statements

**Success criteria:**
1. TX Assessment at visit 8 with pain improved by 2+ points mentions specific improvement type (e.g., "decreased pain with ADL")
2. TX Assessment at visit 16 with cumulative delta >= 3 uses stronger language than visit 4 with same single-visit delta
3. Assessment text contains zero statements outside the existing template vocabulary (grep-verifiable against template constants)
4. When subjective reports "similar" pain but objective shows improvement, assessment does not claim subjective improvement (S<->A consistency)

---

### Phase 15: Batch Form UX
**Requirements:** UX-01, UX-02, UX-03

Frontend-only phase. Optimizes the batch form with ICD-first selection flow and field sizing. Independent of engine work.

**Delivers:**
- ICD code selection before Body Part/Side, with auto-fill from `ICDEntry.bodyPart` and `ICDEntry.laterality`
- Worst/Best/Current pain score fields compacted to ~60px width matching actual character width
- Confirmed ICD codes displayed as chips on the right side of the form row

**Success criteria:**
1. Selecting an ICD code with a known bodyPart auto-fills the Body Part field (only when field is empty or user confirms override)
2. Selecting an ICD code with unilateral laterality auto-fills Side to L or R; mixed laterality codes default to Bilateral
3. Worst/Best/Current fields render at ~60px width and accept 0-10 values without horizontal scroll or clipping
4. Confirmed ICD chips appear to the right of the ICD select field, not above it, and each chip has a remove action

</details>

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
| 12. Fixture Snapshots & Parity Audit | v1.4 | Complete    | 2026-02-23 | 2026-02-23 |
| 13. Recovery Curve & Goals Calibration | v1.4 | 0/? | Not started | — |
| 14. Assessment Reflection | v1.4 | 0/? | Not started | — |
| 15. Batch Form UX | v1.4 | 0/? | Not started | — |
