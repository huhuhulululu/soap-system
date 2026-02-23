# Project Research Summary

**Project:** soap-system v1.5 — Engine & UX Completion
**Domain:** SOAP generation engine — seed passthrough, plateau breaker, Medicare phase gate (acupuncture)
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

v1.5 delivers three features that close the remaining engine gaps: deterministic batch replay via seed passthrough (SEED-01), clinically realistic progression via plateau breaker (PLAT-01), and Medicare NCD 30.3.3 compliance via visit 12 phase gate (GATE-01). All three are implementable with zero new dependencies — the PRNG infrastructure, plateau detection, and insurance type system already exist. The work is pure TypeScript logic additions to existing files.

The recommended approach threads a caller-provided seed through the batch API into the existing `createSeededRng()` pipeline, adds a `consecutiveSameLabel` counter to break 3+ visit pain stalls with a micro-drop (0.3–0.5), and inserts a validation checkpoint at visit 12 for Medicare patients that annotates the note with cumulative improvement evidence. The phase gate is designed as a read-only annotation — it flags insufficient improvement rather than forcing a curve correction, preserving clinical judgment.

The primary risk is PRNG sequence integrity. The plateau breaker modifies the visit loop in `tx-sequence-engine.ts` (1,216 LOC, ~15 `rng()` calls per iteration). Any conditional `rng()` call shifts all subsequent values, breaking 30 fixture snapshots unpredictably. The mitigation is to consume `rng()` unconditionally at a fixed loop position and use the value only when the plateau condition is true. Secondary risk is the phase gate creating a visible discontinuity at visit 12 — avoided by making it a post-generation validator rather than an in-loop curve modifier.

---

## Key Findings

### Recommended Stack

No new packages required. All three features build on existing infrastructure: `mulberry32` PRNG via `createSeededRng()`, plateau detection at line 855, `InsuranceType` union with `ELDERPLAN` for Medicare. See [STACK.md](./STACK.md) for full analysis.

**Core technologies:**
- `tx-sequence-engine.ts` (existing): plateau breaker counter + micro-drop logic (~15 LOC), phase gate detection + `PhaseGateSummary` type (~40 LOC)
- `batch-generator.ts` (existing): seed threading through `generateTXSeries()` and `generateMixedBatch()` (~20 LOC)
- `soap-generator.ts` (existing): Assessment + Plan text enrichment for Medicare gate visits (~25 LOC)

**Alternatives rejected:**
- `json-rules-engine` for phase gate (45KB for 3 threshold checks — NCD 30.3.3 rules are static)
- Zod for seed validation (single `number | undefined` field — inline check sufficient)
- Sub-PRNG for plateau randomness (adds complexity; unconditional `rng()` consumption is simpler)
- Separate `generateMedicareTX()` function (duplicates 90% of assessment logic; conditional block inside existing function is cleaner)

### Expected Features

See [FEATURES.md](./FEATURES.md) for detailed behavior specs and dependency graph.

**Must have (table stakes):**
- SEED-01: Batch seed passthrough — deterministic replay via API, already works in compose path
- PLAT-01: Plateau breaker — break 3+ consecutive identical pain labels with micro-improvement
- GATE-01: Medicare Visit 12 phase gate — annotate visit 12 with cumulative improvement evidence for NCD 30.3.3

**Should have (competitive):**
- GATE-01b: Visit 12 RE note auto-flag — mark visit 12 for re-evaluation note type
- Per-patient seed display in batch results UI

**Defer (v2+):**
- Multi-phase recovery curve (acute/corrective/maintenance segments)
- Plateau breaker for non-pain metrics (ROM, strength stalls)
- Per-patient seed in Excel template column
- Auto-generated RE note content at visit 12

### Architecture Approach

No new files. All features integrate into existing modules. The seed passthrough is server-only plumbing (`batch-generator.ts` + `batch.ts`). The plateau breaker is an engine-only change (`tx-sequence-engine.ts`). The phase gate touches engine + generator + types but follows the existing pattern of enriching `TXVisitState` and conditionally appending text in `soap-generator.ts`. See [ARCHITECTURE.md](./ARCHITECTURE.md) for data flow diagrams and file-level change inventory.

**Major components:**
1. `tx-sequence-engine.ts` — plateau breaker counter + nudge (~15 LOC), phase gate detection + summary (~40 LOC)
2. `batch-generator.ts` + `batch.ts` — seed threading through batch API (~25 LOC)
3. `soap-generator.ts` — Assessment + Plan enrichment for Medicare gate visits (~25 LOC)
4. `normalize-generation-context.ts` + `src/types/index.ts` — `isMedicare` derivation (~4 LOC)
5. `soap-constraints.ts` — optional G01 validation rule (~15 LOC)

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for 9 pitfalls with recovery strategies.

1. **Seed stored but never reaches TX engine** — `regenerateVisit()` routes TX visits to single-visit IE generator, bypassing sequence engine. Fix: create `regenerateTXSeries(patient, seed)` that re-runs full sequence.
2. **New `rng()` calls shift entire PRNG sequence** — conditional `rng()` in plateau branch breaks all downstream values. Fix: consume `rng()` unconditionally at fixed loop position.
3. **Plateau breaker violates monotonic constraint via snap quantization** — micro-drop can produce label oscillation at zone boundaries (6.24→"6", 6.30→"7-6"). Fix: post-snap label monotonic guard.
4. **Phase gate creates hard discontinuity at visit 12** — forced improvement looks engineered to auditors. Fix: gate is validation-only, not a curve modifier; calibrate curve so visit 12 passes naturally.
5. **Phase gate applied to non-Medicare insurance types** — NCD 30.3.3 only applies to Medicare. Fix: gate on `isMedicare(insuranceType)` helper; confirm ELDERPLAN mapping with clinic.

---

## Implications for Roadmap

Based on research, the build order is driven by PRNG stability (plateau breaker must land first so snapshots are re-baselined once) and the dependency chain PLAT-01 → GATE-01 (plateau breaker prevents flat sequences that would fail the phase gate).

### Phase 1: Seed Passthrough (SEED-01)
**Rationale:** Zero engine risk. Pure server-side plumbing. Unblocks deterministic testing for Phases 2 and 3.
**Delivers:** Batch API accepts optional `seed`/`seeds[]`; response includes per-patient seeds; replay with same seeds produces identical output.
**Addresses:** SEED-01 (batch seed passthrough), SEED-01b (batch replay from stored seeds)
**Avoids:** Pitfall 1 (seed doesn't reach TX engine) — by wiring `regenerateTXSeries()` through the sequence engine

### Phase 2: Plateau Breaker (PLAT-01)
**Rationale:** Isolated engine change. Must land before phase gate because it prevents the flat sequences that would fail the visit 12 checkpoint. Snapshot re-baseline happens once here.
**Delivers:** `consecutiveSameLabel` counter; micro-drop (0.3–0.5) when counter ≥ 3; no 3+ consecutive identical pain labels; updated fixture snapshots.
**Uses:** `tx-sequence-engine.ts` (lines 855-870 plateau block)
**Implements:** Plateau breaker logic inside existing visit loop
**Avoids:** Pitfall 2 (PRNG shift) — unconditional `rng()` consumption; Pitfall 3 (monotonic violation) — post-snap label guard; Pitfall 7 (fires on visit 1) — `visitIndex >= 3` guard

### Phase 3: Medicare Phase Gate (GATE-01)
**Rationale:** Depends on stable plateau behavior from Phase 2. Most files touched, most new types. Gate is validation-only — annotates visit 12 with improvement evidence, does not modify the curve.
**Delivers:** `PhaseGateSummary` type; `isPhaseGate` flag on `TXVisitState`; Assessment + Plan enrichment for Medicare visits; `isMedicare` derivation in context; optional G01 constraint rule.
**Uses:** `tx-sequence-engine.ts`, `soap-generator.ts`, `normalize-generation-context.ts`, `src/types/index.ts`, `soap-constraints.ts`
**Implements:** Phase gate detection at visit 12, cumulative improvement summary, NCD 30.3.3 compliance text
**Avoids:** Pitfall 4 (curve discontinuity) — validation-only design; Pitfall 5 (non-Medicare gate) — `isMedicare()` guard; Pitfall 9 (template vocabulary) — standard template text, compliance flag as metadata

### Phase Ordering Rationale

- Phase 1 first because it has zero engine risk and enables deterministic seed-based testing for Phases 2-3
- Phase 2 before Phase 3 because the plateau breaker changes PRNG call patterns — snapshots should be re-baselined once, not twice
- Phase 2 before Phase 3 because plateau breaker prevents flat sequences that would fail the phase gate, reducing the need for forced corrections
- Phase 3 last because it touches the most files and depends on stable engine behavior from Phase 2

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** PRNG call ordering — verify that unconditional `rng()` consumption preserves parity between batch and compose paths; test with 9 parity seeds
- **Phase 3:** MDLand template compatibility — verify that gate assessment text matches `whitelist.json` dropdown options before implementation

Phases with standard patterns (skip research-phase):
- **Phase 1:** API parameter threading — trivial route + service change, well-established pattern in existing `regenerateVisit()` endpoint

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all features verified against existing codebase with line-level references |
| Features | HIGH | Feature specs derived from CMS NCD 30.3.3, direct engine analysis, and existing PRNG infrastructure |
| Architecture | HIGH | All source files read directly; data flow traced end-to-end through batch API → generator → engine → SOAP output |
| Pitfalls | HIGH | 9 pitfalls identified from code-level analysis including PRNG cascade, snap quantization boundaries, and MDLand automation idempotency |

**Overall confidence:** HIGH

### Gaps to Address

- **MDLand ICD/CPT idempotency on regeneration:** The automation's append-only behavior causes duplicate codes when regenerating with a new seed. Needs investigation of MDLand DOM for clear/remove capability during SEED-01 implementation.
- **ELDERPLAN → Medicare mapping confirmation:** The system assumes ELDERPLAN = Medicare Advantage. This is a business logic decision that should be confirmed with the clinic before GATE-01 implementation.
- **Plateau breaker magnitude tuning:** The 0.3–0.5 micro-drop range is derived from `snapPainToGrid` zone width analysis but hasn't been validated against 20-visit chronic sequences at scale. Needs empirical testing with 50+ seeds during PLAT-01 implementation.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `tx-sequence-engine.ts` (1,216 LOC), `batch-generator.ts` (332 LOC), `batch.ts` (282 LOC), `soap-generator.ts` (~2,000 LOC), `server/types.ts`, `normalize-generation-context.ts` (167 LOC), `soap-constraints.ts`, `fixture-snapshots.test.ts` (30 fixtures), `parity-diff.test.ts` (9 seeds)
- [CMS NCD 30.3.3 — Acupuncture for Chronic Lower Back Pain](https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=373) — 12+8 visit structure, improvement requirement, discontinuation criteria

### Secondary (MEDIUM confidence)
- [Medicare.gov — Acupuncture Coverage](https://medicare.gov/coverage/acupuncture) — 20 session annual cap, patient-facing summary
- [Humana — Does Medicare Cover Acupuncture?](https://www.humana.com/medicare/medicare-resources/does-medicare-cover-acupuncture) — reassessment documentation expectations
- [Acupuncture Today — Documentation Best Practices](https://acupuncturetoday.com/article/33757) — plateau documentation in SOAP notes

### Tertiary (LOW confidence)
- Plateau breaker micro-drop magnitude (0.3–0.5) — derived from `snapPainToGrid` zone width analysis, not clinical literature; needs empirical validation

---
*Research completed: 2026-02-22*
*Ready for roadmap: yes*
