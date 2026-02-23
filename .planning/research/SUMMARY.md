# Project Research Summary

**Project:** soap-system v1.4 — UX & Engine Tuning
**Domain:** SOAP generation engine calibration + batch form UX optimization (acupuncture)
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

This milestone tunes the SOAP generation engine for 20-visit chronic pain courses and brings the batch form to feature parity with the compose path. The system already generates clinically valid SOAP notes for 12-visit plans; v1.4 extends that to 20-visit Medicare-compliant courses (NCD 30.3.3: 12 initial + 8 additional), fixes the recovery curve that flattens too early, makes the Assessment section reflect cumulative improvement with concrete deltas, and adds ICD-first selection flow to BatchView.

The recommended approach is zero new dependencies. All four features — ICD auto-mapping, recovery curve recalibration, assessment reflection, and batch/compose parity — build on existing infrastructure. The ICD catalog already has `bodyPart` and `laterality` on every entry. The recovery curve math in `tx-sequence-engine.ts` needs a chronic-aware variant, not a rewrite. The assessment chain in `deriveAssessmentFromSOA()` needs cumulative delta inputs, not a new template engine. The batch path already shares `soap-generator.ts` with compose — the gap is context normalization, not generation logic.

The highest risk is modifying `tx-sequence-engine.ts` (1,216 LOC, ~15 seeded RNG calls per visit loop). Any change to the engine shifts the PRNG sequence, invalidating existing seed-based reproducibility. Fixture snapshots must be captured before any engine work begins. The second risk is BatchView.vue (1,697 LOC monolith) — adding ICD-first flow without first extracting a `PatientForm.vue` component will cause regression cascades through tightly coupled state.

---

## Key Findings

### Recommended Stack

No new packages required. All v1.4 features are implementable with the existing stack. The ICD-to-body-part mapping is a `Map` built from existing `ICDEntry.bodyPart` fields at module load. Recovery curve tuning is pure math in `tx-sequence-engine.ts`. Assessment reflection extends `deriveAssessmentFromSOA()` with cumulative delta inputs. Field sizing uses existing Tailwind `col-span-*` classes.

**Core technologies:**
- `icd-catalog.ts` (existing): ICD→bodyPart+laterality reverse lookup — data already populated on all 70+ entries
- `tx-sequence-engine.ts` (existing): chronic curve variant using linear-blend instead of sqrt+smoothstep for txCount ≥ 16
- `goals-calculator.ts` (existing): `OPTIMAL_END_RATIO` scaled by visit count (0.25 for 12 visits, 0.35 for 20 visits)
- `deriveAssessmentFromSOA()` (existing): cumulative pain delta + ADL improvement tracking for concrete assessment text

**Alternatives rejected:**
- Fuse.js for ICD search (80 entries don't justify fuzzy search overhead)
- D3/Chart.js for curve visualization (not in scope; ApexCharts already in deps if needed later)
- LLM-generated assessment text (non-deterministic, breaks reproducibility, compliance risk)
- Zod for batch form validation (out of scope for this milestone, but recommended for v1.5 parity layer)

### Expected Features

**Must have (table stakes):**
- ICD → Body Part + Side auto-fill — data exists, just not wired as primary input in BatchView
- Batch/Compose generation parity — same patient must produce identical SOAP via both paths
- Assessment reflects visit-over-visit improvement — auditors expect specific S→O→A references
- Recovery curve spread for 20-visit chronic plans — current curve flattens by visit 12, leaving 8 visits with no measurable progress

**Should have (competitive):**
- Realistic LTG for chronic patients — `OPTIMAL_END_RATIO=0.25` (pain 8→2) is unrealistic; chronic pain literature supports 30-50% reduction
- ICD confirmation chips repositioned to right side of form row
- Worst/Best/Current pain fields compacted to 60px width

**Defer (v1.5+):**
- Strength/ROM centralized calculation — trigger only if IE/TX strength inconsistency found in audit
- Visit 12 Medicare phase gate — trigger only if clinic needs Medicare billing compliance
- Body-part grouping headers in ICD dropdown — only if catalog grows beyond ~100 codes

### Architecture Approach

The architecture stays as-is: Vue 3 SPA → Express 5 → generation engine (`soap-generator.ts` + `tx-sequence-engine.ts` + `goals-calculator.ts`). The only new file is `src/shared/icd-body-resolver.ts` (~50 LOC), extracting `syncBodyPartFromIcds()` logic so both BatchView and WriterPanel share a single ICD→bodyPart+laterality resolver. All engine changes are modifications to existing functions with backward-compatible optional parameters.

**Major components modified:**
1. `tx-sequence-engine.ts` — chronic curve variant, plateau breaker, cumulative delta tracking, assessment reflection rules (HIGH complexity)
2. `BatchView.vue` — ICD-first toggle, field width optimization, seed display (MEDIUM complexity)
3. `goals-calculator.ts` — `visitCount` param for LTG realism (LOW complexity)
4. `soap-generator.ts` — late-stage summary sentence in `generateAssessmentTX()` (LOW complexity)
5. `batch-generator.ts` + `batch.ts` — seed passthrough for regeneration (LOW complexity)

### Critical Pitfalls

1. **ICD auto-mapping overwrites user's intentional body part** — only auto-map when body part field is empty; track `bodyPartManuallySet` flag; show confirmation toast instead of silent override
2. **Laterality inference conflict** — ICD code laterality (billing specificity) ≠ clinical laterality (patient's side); only infer when ALL selected codes agree; mixed codes default to bilateral
3. **Recovery curve breaks monotonic constraint validators** — flattening reduces per-visit deltas below `snapPainToGrid` quantization threshold; reduce `NOISE_CAP` proportionally; add post-snap label monotonic guard
4. **Assessment S↔A contradiction** — assessment claims "improvement" while subjective says "similar" when objective metrics improve but pain plateaus; gate assessment `present` on final `symptomChange` value
5. **Seed reproducibility invalidated by engine changes** — any new `rng()` call shifts the entire PRNG sequence; snapshot 30 reference fixtures before modifications; append new RNG calls at end of loop

---

## Implications for Roadmap

Based on research, the build order is driven by two dependency chains: (1) shared resolver → BatchView UX, and (2) recovery curve → assessment reflection. A Phase 0 pre-work step is required to snapshot fixtures and extract the BatchView form component before any feature work begins.

### Phase 0: Pre-Work (Fixtures + Component Extraction)
**Rationale:** Engine changes invalidate seed reproducibility; BatchView changes cause regressions in a 1,697-line monolith. Both risks must be mitigated before feature work.
**Delivers:** 30 reference seed fixtures in `src/generator/__fixtures__/`; `PatientForm.vue` extracted from BatchView; `usePatientValidation.ts` composable
**Addresses:** Pitfall 6 (seed reproducibility), Pitfall 7 (BatchView regression)
**Avoids:** Untestable engine changes; cascading form regressions

### Phase 1: Shared Foundation (ICD Resolver + Parity Audit)
**Rationale:** ICD-first flow and batch/compose parity are prerequisites for all other features. The shared resolver must exist before BatchView wires it. Parity must be fixed before engine tuning, because engine changes tested against one path will silently break the other.
**Delivers:** `src/shared/icd-body-resolver.ts`; `normalizeGenerationContext()` shared function; parity diff test
**Addresses:** ICD auto-mapping (P1), Batch/Compose parity (P1)
**Avoids:** Duplicating ICD logic between views; parity drift after engine changes

### Phase 2: Recovery Curve + Goals Calibration
**Rationale:** The curve and goals must ship together — if the curve flattens but LTG still promises pain 2, the last 8 visits show no progress toward an unreachable goal. This is the highest-risk engine change.
**Delivers:** Chronic curve variant (linear-blend for txCount ≥ 16); plateau breaker (micro-improvement when pain stalls 3+ visits); `OPTIMAL_END_RATIO` scaled by visit count; `NOISE_CAP` reduced for longer plans
**Uses:** `tx-sequence-engine.ts`, `goals-calculator.ts`
**Addresses:** Recovery curve flattening (P1), Realistic LTG (P1), Pitfall 3 (monotonic constraint), Pitfall 8 (goals disconnect)

### Phase 3: Assessment Improvement Reflection
**Rationale:** Depends on Phase 2 — the plateau behavior changes how assessment text is generated. Cumulative delta tracking requires the recovery curve to be stable first.
**Delivers:** `cumulativePainDelta` passed to `deriveAssessmentFromSOA`; stronger language for cumulative delta ≥ 3; ADL improvement mention when `adlChange === 'improved'`; late-stage summary for progress > 0.8
**Uses:** `tx-sequence-engine.ts`, `soap-generator.ts`
**Addresses:** Assessment reflection (P1), Pitfall 4 (S↔A contradiction)

### Phase 4: Batch UX (Frontend)
**Rationale:** Can run in parallel with Phases 2-3 after Phase 1 completes. Uses the shared ICD resolver from Phase 1 and the extracted PatientForm from Phase 0.
**Delivers:** ICD-first toggle in BatchView; field width optimization (W/B/C → 3-col inline); ICD chips repositioned to right column; seed display + copy in review step
**Uses:** `icd-body-resolver.ts` (Phase 1), `PatientForm.vue` (Phase 0)
**Addresses:** ICD auto-fill (P1), field sizing (P1), ICD chips (P1)

### Phase 5: Batch Seed Control (Server)
**Rationale:** Depends on Phase 4 (seed display in UI) and Phase 2 (engine changes that shift seed output). Last because it's lowest risk and lowest priority.
**Delivers:** Seed passthrough in `batch-generator.ts` + `batch.ts` regenerate endpoint
**Addresses:** Batch/Compose parity gap (seed control)

### Phase Ordering Rationale

- Phase 0 before everything because fixture snapshots are the regression safety net for all engine changes, and PatientForm extraction contains the blast radius of BatchView modifications
- Phase 1 before engine work because parity bugs discovered after engine tuning are 3x harder to diagnose (is it a parity bug or an engine bug?)
- Phase 2 before Phase 3 because assessment reflection depends on stable plateau behavior from the recovery curve
- Phases 2-3 (engine) and Phase 4 (frontend) can run in parallel after Phase 1 — no cross-dependencies
- Phase 5 last because seed control is a convenience feature, not a correctness requirement

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Recovery curve math — the piecewise linear-blend parameters need empirical tuning with real 20-visit sequences; run 50+ seeds and validate against `soap-constraints.ts`

Phases with standard patterns (skip research-phase):
- **Phase 0:** Component extraction + fixture snapshots — standard Vue refactoring, no domain research needed
- **Phase 1:** Shared utility extraction + parity test — straightforward code extraction
- **Phase 3:** Assessment template extension — pattern already established in `deriveAssessmentFromSOA`
- **Phase 4:** Form layout changes — pure Tailwind/Vue template work
- **Phase 5:** API parameter passthrough — trivial route change

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies; all features use existing modules verified via direct code inspection |
| Features | HIGH | Feature landscape derived from CMS NCD 30.3.3, clinical literature, and direct codebase analysis |
| Architecture | HIGH | All source files read directly; data flow traced through generation pipeline end-to-end |
| Pitfalls | HIGH | 8 pitfalls identified from code-level analysis; recovery strategies documented with specific file/line references |

**Overall confidence:** HIGH

### Gaps to Address

- **Chronic curve parameters:** The linear-blend curve shape for 20-visit plans needs empirical validation with real clinical expectations. The proposed 3-segment piecewise curve (30-40% / 30-35% / 20-25% improvement distribution) is based on the "Steps of Care" model but hasn't been tested against the constraint validator at scale.
- **`snapPainToGrid` zone boundary behavior:** The interaction between reduced `NOISE_CAP` and the 0.25/0.75 quantization thresholds needs testing with edge-case seeds to confirm no V01 violations.
- **Parity test coverage:** The exact set of fields where batch and compose diverge (painTypes format, symptomScale default, medicalHistory undefined vs empty array) needs a comprehensive audit during Phase 1 implementation.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `tx-sequence-engine.ts` (1,216 LOC), `soap-generator.ts` (~2,000 LOC), `goals-calculator.ts` (233 LOC), `objective-patch.ts` (707 LOC), `icd-catalog.ts` (157 LOC), `body-part-constants.ts` (225 LOC), `BatchView.vue` (1,697 LOC), `WriterPanel.vue` (~800 LOC), `batch-generator.ts` (379 LOC)
- ICD-10 laterality encoding: CMS ICD-10-CM Official Guidelines, Chapter 19

### Secondary (MEDIUM confidence)
- [CMS NCD 30.3.3 — Acupuncture for Chronic Lower Back Pain](https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=373) — 20-visit Medicare cap
- [Acupuncture Media Works — Steps of Care recovery curve](https://acupuncturemediaworks.com/products/steps-of-care-laminated-chart) — 3-phase recovery model
- [arXiv 2404.06503 — Comparing Two Model Designs for Clinical Note Generation](https://arxiv.org/html/2404.06503v1) — holistic vs independent SOAP generation parity

### Tertiary (LOW confidence)
- Chronic pain LTG realism (30-50% reduction target) — derived from clinical literature consensus, not a single authoritative source; needs validation with practicing clinicians

---
*Research completed: 2026-02-22*
*Ready for roadmap: yes*
