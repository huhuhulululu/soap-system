# Pitfalls Research

**Domain:** v1.5 new features — seed passthrough (SEED-01), plateau breaker (PLAT-01), Medicare phase gate (GATE-01)
**Researched:** 2026-02-22
**Confidence:** HIGH (direct analysis of tx-sequence-engine.ts, batch-generator.ts, normalize-generation-context.ts, fixture-snapshots.test.ts, mdland-automation.ts, and CMS NCD 30.3.3)

---

## Critical Pitfalls

### Pitfall 1: Seed Passthrough Stored But Never Reaches TX Sequence Engine

**What goes wrong:**
`batch-generator.ts` generates a random seed at line 96 (`Math.floor(Math.random() * 100000)`) and stores it in `visit.generated.seed`. But when the user calls `regenerateVisit()` (line 324) to re-generate with the same seed, the function delegates to `generateSingleVisit()` which calls `exportSOAPAsText(context)` — a single-visit IE/RE generator that doesn't use the TX sequence engine at all. The seed parameter is accepted but never passed to `exportTXSeriesAsText()`. Re-generation with a stored seed produces completely different output because it bypasses the sequence engine entirely.

**Why it happens:**
`regenerateVisit()` was designed for single IE/RE re-generation. TX visits are generated as a batch via `generateTXSeries()`. There's no `regenerateTXWithSeed()` function that re-runs the full sequence engine with a stored seed and extracts the specific visit. The API surface suggests seed-based regeneration works, but the plumbing doesn't connect.

**How to avoid:**
- `regenerateVisit()` must detect `visit.noteType === 'TX'` and route to a TX-specific path that calls `exportTXSeriesAsText()` with the stored seed, then returns only the requested visit index.
- The seed must be stored per-patient (not per-visit) because all TX visits for one patient share a single PRNG sequence. Storing per-visit creates the illusion that individual visits can be regenerated independently.
- Add a `regenerateTXSeries(patient, seed)` function that re-runs the full sequence and returns all TX visits. The frontend can then replace the entire TX series atomically.

**Warning signs:**
- User copies seed from visit review, pastes it into regenerate, gets different SOAP text
- `regenerateVisit()` called with seed for a TX visit produces IE-style output (no sequence progression)
- Seed stored as `0` (from `options.seed ?? 0` fallback at line 118) when `options.seed` is undefined

**Phase to address:** SEED-01 implementation — must fix the regeneration path before exposing seed UI.

---

### Pitfall 2: New `rng()` Calls in Plateau Breaker Shift Entire PRNG Sequence

**What goes wrong:**
The plateau breaker needs randomness to decide micro-improvement magnitude (e.g., `0.2 + rng() * 0.1` for pain drop). Adding this `rng()` call inside the visit loop shifts every subsequent random value for all remaining visits. The existing ~15 `rng()` calls per iteration (lines 735-882) are order-dependent. Inserting one call at the plateau detection point (line 855) means visits after the first plateau get different symptomChange, reason, tightnessGrading, tendernessGrading, needlePoints, and spasmGrading values. All 30 fixture snapshots break.

**Why it happens:**
`mulberry32` is a sequential PRNG — the Nth call always returns the same value for a given seed, but inserting a call at position K shifts positions K+1 through N. The plateau breaker is conditional (only fires when `plateau === true`), making the shift non-deterministic across seeds. Some seeds trigger plateau at visit 5, others at visit 8, so the cascade differs per seed.

**How to avoid:**
- Append all new `rng()` calls at the END of the visit loop body (after line 1196), not at the plateau detection point. Consume the random value unconditionally (even when plateau is false) to keep the call count constant per iteration.
- Alternative: create a sub-PRNG for plateau decisions: `const plateauRng = mulberry32(seed + 0x50_4C_41_54)`. This isolates plateau randomness from the main sequence entirely. Changes to plateau logic never affect other fields.
- Before any engine change, run `npx vitest run src/generator/__fixtures__/fixture-snapshots.test.ts` and confirm 30/30 pass. After changes, run `--update` only after reviewing diffs.

**Warning signs:**
- Fixture snapshot tests fail on visits AFTER the first plateau occurrence (not on the plateau visit itself)
- Different seeds break at different visit indices (non-uniform failure pattern)
- Parity diff tests (9 cases) fail because batch and compose paths now diverge on plateau timing

**Phase to address:** PLAT-01 implementation — must be the first engine change, before recovery curve or assessment modifications.

---

### Pitfall 3: Plateau Breaker Violates Monotonic Pain Constraint via snapPainToGrid Quantization

**What goes wrong:**
The plateau breaker injects a micro-improvement when pain stalls (e.g., force `rawPain -= 0.25`). But `snapPainToGrid` has zone boundaries at 0.25 and 0.75 fractions. A pain value of 6.30 snaps to label "7-6" (range zone). After plateau breaker drops it to 6.05, it snaps to label "6" (integer zone). This looks correct. But if the PREVIOUS visit had pain 6.24 which snapped to "6" (below 0.25 threshold), the current visit's pre-plateau value of 6.30 would have snapped to "7-6" — an apparent INCREASE. The monotonic guard at line 768 (`painScaleCurrent = Math.min(prevPain, snapped.value)`) catches the numeric value but the LABEL can still show "7-6" > "6" if the guard clamps the value but not the label.

**Why it happens:**
The existing monotonic guard operates on `snapped.value` (numeric) but the label is derived from `snapped.label` (string). Lines 770-772 re-snap if `painScaleCurrent < snapped.value`, but this only fires when the guard actually clamped. The plateau breaker changes the raw pain BEFORE snapping, so the guard may not trigger, but the label sequence can still appear non-monotonic to the checker which parses labels.

**How to avoid:**
- After plateau breaker adjusts `rawPain`, apply the same monotonic label guard: if the new label parses to a higher value than `prevPainScaleLabel`, force the label to `prevPainScaleLabel`.
- Add a post-loop assertion: iterate all visits and verify `parseInt(visit.painScaleLabel) <= parseInt(prevVisit.painScaleLabel)` for range labels (take the higher number).
- Test with seeds that produce pain values near zone boundaries (6.24, 6.26, 6.74, 6.76) — these are the fragile points.

**Warning signs:**
- Checker V01 violations appearing only on specific seeds (boundary-sensitive)
- Pain label sequence like "7-6", "6", "7-6", "6" (oscillation at boundary)
- `snapPainToGrid` returning different labels for values that differ by < 0.05

**Phase to address:** PLAT-01 implementation — must be validated with constraint checker before merging.

---

### Pitfall 4: Medicare Phase Gate at Visit 12 Creates Hard Discontinuity in Recovery Curve

**What goes wrong:**
NCD 30.3.3 requires "documented improvement" at visit 12 to authorize visits 13-20. The naive implementation checks `if (visitIndex === 12) { assertImprovement() }` and forces a pain drop if improvement is insufficient. This creates a visible discontinuity — visits 11-12 show a sudden jump in improvement that doesn't match the gradual curve before and after. Auditors reviewing the full 20-visit sequence see an unnatural acceleration at exactly visit 12, which looks like the notes were engineered to pass the checkpoint rather than reflecting genuine clinical progress.

**Why it happens:**
The recovery curve is continuous (sqrt + smoothstep). Injecting a forced improvement at a specific visit index creates a step function discontinuity. The S→O→A chain then amplifies it: forced pain drop → assessment says "improvement" → but objective metrics (tightness, ROM) haven't caught up because they lag pain by design (lines 816-844). The visit 12 note has subjective improvement without matching objective support.

**How to avoid:**
- Don't force improvement AT visit 12. Instead, calibrate the recovery curve so that cumulative improvement by visit 12 is always sufficient. The curve parameters (`progressMultiplier`, `ST_PROGRESS`) should guarantee that `startPain - painAtVisit12 >= minimumDelta` for all valid starting conditions.
- The phase gate should be a VALIDATION check, not a generation modifier. After generating the full sequence, verify that visit 12 shows sufficient improvement. If it doesn't, flag the patient for clinical review rather than silently adjusting the curve.
- If forced adjustment is unavoidable, spread it across visits 10-12 (not just visit 12) by slightly increasing the progress rate in that window. This preserves curve smoothness.

**Warning signs:**
- Visit 12 pain drop is 2x larger than adjacent visits' drops
- Assessment at visit 12 says "significant improvement" while visit 11 said "slight improvement"
- Objective metrics (tightness, ROM) at visit 12 don't reflect the subjective improvement
- Auditor flags visit 12 as "clinically implausible acceleration"

**Phase to address:** GATE-01 implementation — must be designed AFTER recovery curve calibration (CRV-01/CRV-02) is stable.

---

### Pitfall 5: Medicare Phase Gate Applied to Non-Medicare Insurance Types

**What goes wrong:**
The system has 6 insurance types: HF, OPTUM, WC, VC, ELDERPLAN, NONE. NCD 30.3.3 applies only to Medicare beneficiaries. If the phase gate logic is added to `generateTXSequenceStates()` without an insurance type check, it fires for ALL patients — including commercial insurance (HF, WC, VC) patients who have no 12-visit checkpoint requirement. This unnecessarily constrains the recovery curve for non-Medicare patients and may produce suboptimal note sequences.

**Why it happens:**
`generateTXSequenceStates()` receives `GenerationContext` which has `insuranceType`, but the current engine doesn't branch on insurance type for clinical progression (only for CPT code selection in `INSURANCE_NEEDLE_MAP`). Adding insurance-conditional logic to the engine is a new pattern. The temptation is to apply the gate universally "for safety" — but this over-constrains non-Medicare patients.

**How to avoid:**
- The phase gate check must be gated on `context.insuranceType`. Determine which insurance types map to Medicare: likely ELDERPLAN (Medicare Advantage) and potentially NONE (if the clinic bills Medicare directly). HF, OPTUM, WC, VC are commercial Medicaid plans — NCD 30.3.3 does not apply.
- Add `isMedicare(insuranceType)` helper to `src/shared/` that returns true for Medicare-applicable types. Use this in both the engine gate and any UI warnings.
- Confirm with the clinic which `InsuranceType` values correspond to Medicare beneficiaries. This is a business logic decision, not a technical one.

**Warning signs:**
- Commercial insurance patients getting visit-12 checkpoint warnings in the UI
- Recovery curves for HF/WC patients showing the same forced improvement pattern as Medicare patients
- Clinic staff confused by "Medicare compliance" messages for non-Medicare patients

**Phase to address:** GATE-01 implementation — insurance type mapping must be confirmed before coding the gate.

---

### Pitfall 6: MDLand ICD/CPT Append-Only Behavior Causes Duplicates on Regeneration

**What goes wrong:**
MDLand's ICD/CPT interface is append-only: `addSelectionD(name, code)` adds a code to the list, and `addSelectionD_cpt(name, name, code)` adds a CPT code. There is no "clear all codes" or "replace codes" API. When seed passthrough enables regeneration, the user regenerates a visit with a new seed, which may produce different ICD/CPT codes. The automation re-runs `addICDCodes()` and `addCPTCodes()`, but the previous codes are still in the list. The visit now has duplicate or conflicting codes.

**Why it happens:**
`mdland-automation.ts` `addICDCodes()` (line 595) iterates codes and calls `addSelectionD()` for each. It doesn't check if the code already exists. `addCPTCodes()` (line 641) has the same pattern. The MDLand UI accumulates codes across multiple submissions. The automation was designed for single-pass generation, not iterative regeneration.

**How to avoid:**
- Before adding codes, clear the existing ICD/CPT list. Investigate MDLand's DOM for a "clear all" button or a way to remove individual codes programmatically (e.g., selecting and deleting from the `diag_code_h` hidden inputs).
- If clearing isn't possible, add a pre-check: read the current code list from the DOM, diff against the new codes, only add missing ones and remove extras.
- For seed-based regeneration specifically: if the ICD/CPT codes don't change (only SOAP text changes), skip the ICD/CPT step entirely. The seed only affects the TX sequence engine, not the code selection.

**Warning signs:**
- MDLand showing duplicate ICD codes (e.g., M54.50 appearing twice)
- CPT units doubled (97810 x2 instead of x1) after regeneration
- Claim denials due to duplicate billing codes

**Phase to address:** SEED-01 implementation — must handle MDLand idempotency before enabling regeneration in automation.

---

### Pitfall 7: Plateau Breaker Fires on Visit 1, Creating Impossible "Stalled" Narrative

**What goes wrong:**
The current plateau detection (line 855-857) checks `progress > 0.7 && painDelta < 0.2 && adlDelta < 0.12 && !frequencyImproved` OR `painScaleLabel === prevPainScaleLabel`. The second condition (`painScaleLabel === prevPainScaleLabel`) can be true on visit 1 if the starting pain snaps to the same label as the IE pain. For example, IE pain = 8, TX1 raw pain = 7.80, both snap to "8". The plateau breaker fires on TX1, injecting a micro-improvement on the very first treatment visit — which is clinically nonsensical (you can't be "stalled" after one visit).

**Why it happens:**
`prevPainScaleLabel` is initialized from `snapPainToGrid(startPain).label` before the loop (line 645). On the first iteration, if the pain drop is small enough that the label doesn't change, the label-equality check triggers plateau. The `progress > 0.7` guard in the first condition prevents early firing, but the OR with label equality bypasses it.

**How to avoid:**
- Add a minimum visit count guard: `const plateau = visitIndex >= 3 && (...)`. A patient cannot be "stalled" before visit 3.
- Separate the two plateau conditions: label equality alone should not trigger the breaker — it should only suppress ROM/strength trends (current behavior at lines 858-870). The breaker (forced pain micro-drop) should require the full condition including `progress > 0.7`.
- Track consecutive stall count: only trigger breaker after 3+ consecutive visits with identical pain labels, not on the first occurrence.

**Warning signs:**
- TX1 showing a pain drop that doesn't match the recovery curve's expected early-phase behavior
- Assessment at TX1 mentioning "plateau" or "stalled" language
- Fixture snapshots for early-phase fixtures (3tx) changing unexpectedly

**Phase to address:** PLAT-01 implementation — guard must be in place before any plateau logic is added.

---

### Pitfall 8: Seed Passthrough Exposes Deterministic Pattern to Auditors

**What goes wrong:**
Seed passthrough means the same seed always produces the same SOAP text. If an auditor reviews multiple patients and notices identical phrasing patterns (same symptomChange, same reason, same ADL activities), they may suspect automated generation. Currently, random seeds provide natural variation. Exposing seed control to users means a user could accidentally (or intentionally) reuse the same seed across patients, producing identical notes for different people.

**Why it happens:**
The seed controls the entire PRNG sequence — symptomChange selection, reason selection, ADL activities, needle points (first visit only), tightness/tenderness grading randomness. Two patients with the same body part, pain level, and seed will get byte-identical SOAP text. This is by design for reproducibility, but it's a liability if seeds are reused across patients.

**How to avoid:**
- The UI should display the seed as read-only (for debugging/support) and allow copy, but NOT allow manual seed input for batch generation. Seed input should only be available in a "regenerate single patient" flow.
- If manual seed input is allowed, validate that the seed is unique within the batch. Show a warning if two patients share the same seed.
- Consider incorporating patient-specific entropy into the seed: `effectiveSeed = hash(userSeed, patientName, bodyPart)`. This ensures different patients always get different sequences even with the same user-provided seed.

**Warning signs:**
- Two patients in the same batch having identical symptomChange + reason + ADL sequences
- Auditor flagging "template-like" notes across patients
- User reporting "I used the same seed and got the same notes for different patients"

**Phase to address:** SEED-01 implementation — seed uniqueness validation before exposing UI.

---

### Pitfall 9: Medicare Phase Gate Assessment Language Exceeds Template Vocabulary

**What goes wrong:**
The visit 12 phase gate needs to document "improvement" in specific Medicare-compliant language. The temptation is to add new assessment phrases like "Patient demonstrates clinically meaningful improvement sufficient to warrant continued treatment per NCD 30.3.3." But `deriveAssessmentFromSOA()` returns values that are rendered by `generateAssessmentTX()` in `soap-generator.ts`, which uses template vocabulary from `template-rule-whitelist.ts`. Injecting free-text Medicare language bypasses the template system and may produce text that MDLand's dropdown fields can't accept.

**Why it happens:**
MDLand's SOAP form uses dropdown/combo fields with predefined options (loaded from `whitelist.json`). The generator must produce text that matches these options. Medicare compliance language is regulatory, not clinical — it doesn't map to existing template options. Adding it requires either extending the whitelist (which affects all patients) or injecting it as free-text (which MDLand may reject).

**How to avoid:**
- The Medicare phase gate documentation should be a SEPARATE section or annotation, not embedded in the standard Assessment template text. Consider adding it to the Plan section ("Continue treatment per NCD 30.3.3 — documented improvement at visit 12") where free-text is more acceptable.
- If it must go in Assessment, verify that the exact phrasing exists in MDLand's assessment dropdown options. If not, the gate should produce standard template vocabulary that implies compliance without using regulatory language.
- The gate's output should be a boolean flag (`meetsVisit12Threshold: true`) that the UI displays as a compliance badge, not injected text in the SOAP note itself.

**Warning signs:**
- MDLand automation failing at the SOAP paste step because assessment text doesn't match any dropdown option
- `getTemplateOptionsForField('assessment.*')` returning no match for Medicare-specific phrases
- Generated assessment text longer than MDLand's field character limit

**Phase to address:** GATE-01 implementation — must verify MDLand field constraints before designing gate output format.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing seed per-visit instead of per-patient-TX-series | Simpler data model | Misleading: implies individual TX visits can be regenerated independently; actual PRNG is per-series | Never — seed belongs on the patient/series level |
| Plateau breaker as inline code in the main loop | No new functions to test | Adds another conditional branch to the already 1216-line engine; increases cyclomatic complexity | Only if guarded by `visitIndex >= 3` and consuming rng() unconditionally |
| Medicare gate as engine-internal logic | No new files | Mixes regulatory compliance with clinical generation; insurance-type branching in the engine is a new pattern | Never — gate should be a post-generation validator, not an in-loop modifier |
| Hardcoding visit 12 as the Medicare checkpoint | Matches current NCD 30.3.3 | CMS could change the checkpoint visit count; hardcoded magic number | Acceptable if extracted to a named constant `MEDICARE_PHASE_GATE_VISIT = 12` |
| Reusing `Math.floor(Math.random() * 100000)` for seed generation | Simple | Seed space is only 100k values; collision probability is ~1% at 450 patients (birthday paradox); not cryptographically random | Never for production — use `crypto.getRandomValues()` or at minimum `Math.floor(Math.random() * 0xFFFFFFFF)` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Seed passthrough → batch-generator.ts | Passing seed to `regenerateVisit()` which routes to single-visit IE generator, not TX sequence engine | Create `regenerateTXSeries(patient, seed)` that re-runs full sequence; return all TX visits atomically |
| Seed passthrough → MDLand automation | Re-running automation with new seed without clearing existing ICD/CPT codes | Check if codes changed; if only SOAP text changed, skip ICD/CPT step; if codes changed, clear before re-adding |
| Plateau breaker → fixture snapshots | Adding conditional `rng()` call that shifts sequence only when plateau fires | Consume `rng()` unconditionally at fixed position in loop; use the value only when plateau condition is true |
| Plateau breaker → soaChain assessment | Plateau breaker forces pain drop but `deriveAssessmentFromSOA` sees small `painDelta` and says "slight improvement" | Pass a `plateauBroken: boolean` flag to assessment derivation; use "gradual improvement" language instead of delta-based |
| Medicare gate → insuranceType | Applying NCD 30.3.3 gate to all insurance types | Gate on `isMedicare(insuranceType)`; confirm which InsuranceType values map to Medicare with clinic |
| Medicare gate → recovery curve | Forcing improvement at visit 12 creates discontinuity | Calibrate curve parameters so visit 12 naturally shows sufficient improvement; gate is validation, not generation |
| Medicare gate → MDLand template | Injecting regulatory language that doesn't match MDLand dropdown options | Use standard template vocabulary; add compliance flag as metadata, not inline text |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Seed-based regeneration re-runs full TX sequence to get one visit | Regenerating visit 15 of 20 requires generating all 20 visits | Cache the full sequence result keyed by `(patientId, seed)`; return cached visit on re-request | At 20+ visits per patient with frequent regeneration |
| Plateau detection scanning previous N visits for stall count | O(N) lookback per visit, O(N²) total for sequence | Track `consecutiveStallCount` as a running counter (already done for other metrics) | At 30+ visits (unlikely but possible with continue mode) |
| Medicare gate validation running constraint checker on every generation | `validateGeneratedSequence` is O(visits²) for cross-visit checks | Run gate validation only when `insuranceType` is Medicare AND `txCount >= 12` | At batch sizes > 50 patients |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Seed exposed in API response without access control | Attacker could enumerate seeds to find one that produces favorable notes (e.g., faster improvement curve) | Seeds are not security-sensitive (they control text variation, not clinical validity); but don't expose seed enumeration endpoint |
| Medicare compliance flag stored client-side only | User could modify the flag to bypass the gate check | Gate validation must run server-side in `batch-generator.ts`; client flag is display-only |
| Plateau breaker magnitude not bounded | Unbounded micro-improvement could produce clinically impossible pain drops | Clamp plateau breaker delta to `[0.15, 0.35]` range; never exceed one `snapPainToGrid` step |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Seed displayed as raw integer (e.g., 378146595) | Meaningless to clinicians; confusing | Show seed only in "developer/debug" panel; label it "Regeneration Code" not "Seed" |
| Medicare gate blocks generation instead of warning | User can't generate notes for visit 13+ until visit 12 passes gate | Generate all 20 visits; show warning badge on visit 12 if improvement is insufficient; let user decide |
| Plateau breaker silently modifies pain values | User sees pain values they didn't input; loses trust in the system | Show a subtle indicator (e.g., small icon) on visits where plateau breaker activated; tooltip explains "Pain adjusted to maintain clinical progression" |
| Seed copy button copies per-visit seed | User thinks they can regenerate individual TX visits | Copy button should copy the series seed with a label: "This seed regenerates all TX visits for this patient" |

---

## "Looks Done But Isn't" Checklist

- [ ] **Seed passthrough:** Verify `regenerateVisit()` with a TX visit actually calls `exportTXSeriesAsText()`, not `exportSOAPAsText()` — test by regenerating TX visit 5 of 12 and checking it has sequence-aware progression
- [ ] **Seed passthrough:** Verify seed is stored per-patient-series, not per-visit — check that all TX visits for one patient show the same seed value
- [ ] **Seed passthrough:** Verify seed space is >= 2^32, not 100000 — check `Math.random() * 100000` is replaced with full 32-bit range
- [ ] **Plateau breaker:** Verify it does NOT fire on visits 1-2 — test with 3tx fixtures, confirm no plateau activation
- [ ] **Plateau breaker:** Verify `rng()` call count per iteration is constant regardless of plateau condition — count calls in plateau=true vs plateau=false paths
- [ ] **Plateau breaker:** Verify all 30 fixture snapshots pass after implementation — run `npx vitest run src/generator/__fixtures__/fixture-snapshots.test.ts`
- [ ] **Plateau breaker:** Verify pain labels remain monotonically non-increasing after breaker fires — run constraint checker on 20-visit sequences with 10 seeds
- [ ] **Medicare gate:** Verify gate only fires for Medicare insurance types — test with HF, OPTUM, WC patients at visit 12, confirm no gate activation
- [ ] **Medicare gate:** Verify visit 12 assessment uses standard template vocabulary — check output against `whitelist.json` options
- [ ] **Medicare gate:** Verify gate is validation (post-generation check), not generation modifier — confirm recovery curve shape is identical with and without gate enabled
- [ ] **MDLand regeneration:** Verify ICD/CPT codes are not duplicated after regeneration — automate: generate, regenerate with new seed, check code count unchanged

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Seed doesn't reach TX engine | LOW | Add `regenerateTXSeries()` function; route TX visits through it |
| PRNG sequence shifted by plateau breaker | MEDIUM | Move new `rng()` calls to end of loop; consume unconditionally; re-snapshot fixtures |
| Plateau breaker violates monotonic constraint | LOW | Add post-snap label monotonic guard; clamp breaker delta |
| Medicare gate creates curve discontinuity | HIGH | Redesign as post-generation validator; recalibrate curve parameters instead of forcing |
| Gate applied to non-Medicare patients | LOW | Add `isMedicare()` guard; gate on insurance type |
| MDLand duplicate codes on regeneration | MEDIUM | Add pre-clear step or diff-based code management in automation |
| Plateau fires on visit 1 | LOW | Add `visitIndex >= 3` guard |
| Seed reuse across patients | LOW | Add per-batch seed uniqueness validation; incorporate patient entropy |
| Medicare language exceeds template vocabulary | MEDIUM | Move compliance text to Plan section or metadata flag; verify against MDLand fields |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Seed doesn't reach TX engine | SEED-01 | Regenerate TX visit with stored seed; compare output to original — must be byte-identical |
| PRNG sequence shifted | PLAT-01 (before any engine change) | 30 fixture snapshots pass; 9 parity diffs pass |
| Monotonic constraint violation | PLAT-01 | Run `validateGeneratedSequence` on 20-visit sequences with 20 seeds, 0 V01 violations |
| Curve discontinuity at visit 12 | GATE-01 (after CRV-01/CRV-02) | Plot pain curve for 20-visit sequence; verify no step > 2x adjacent steps at visit 12 |
| Gate on non-Medicare patients | GATE-01 | Generate batch with mixed insurance types; verify gate only activates for Medicare |
| MDLand duplicate codes | SEED-01 | Automate: generate → regenerate → count ICD codes in DOM; expect no duplicates |
| Plateau fires on visit 1 | PLAT-01 | Run 3tx fixtures; verify no plateau activation in any visit |
| Seed reuse across patients | SEED-01 | Generate 10-patient batch; verify all seeds are unique |
| Assessment exceeds template vocabulary | GATE-01 | Grep visit 12 assessment text against `whitelist.json`; all phrases must match |

---

## Implementation Order Constraint

The three features have strict ordering dependencies:

```
PLAT-01 (plateau breaker)
    ↓ must be stable before
CRV-01/CRV-02 (recovery curve calibration)
    ↓ must be stable before
GATE-01 (Medicare phase gate)
    ↓ independent of
SEED-01 (seed passthrough)
```

Rationale:
- PLAT-01 changes the PRNG call pattern — must be done first so fixture snapshots can be re-baselined once
- CRV-01/CRV-02 depends on stable plateau behavior to calibrate the curve shape
- GATE-01 depends on the final curve shape to set the visit-12 improvement threshold
- SEED-01 is orthogonal to engine changes — it's a plumbing fix in `batch-generator.ts` and UI work

---

## Sources

- Direct codebase analysis: `src/generator/tx-sequence-engine.ts` (1216 LOC), `server/services/batch-generator.ts` (332 LOC), `src/shared/normalize-generation-context.ts` (167 LOC), `src/generator/__fixtures__/fixture-snapshots.test.ts`, `src/generator/__fixtures__/parity-diff.test.ts`, `scripts/playwright/mdland-automation.ts`
- [CMS NCD 30.3.3 — Acupuncture for Chronic Lower Back Pain](https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=373&NCDver=1) — 12+8 visit structure, improvement requirement
- [Medicare.gov — Acupuncture coverage](https://medicare.gov/coverage/acupuncture) — patient-facing coverage summary
- [AAPC — Billing Acupuncture for cLBP](https://www.aapc.com/blog/90501-think-positive-when-billing-acupuncture-for-clbp/) — coding and compliance guidance
- Seeded PRNG cascade effect: known property of sequential PRNGs (Mulberry32) — inserting calls shifts all subsequent values
- v1.4 PITFALLS.md (previous version) — Pitfalls 3, 4, 6 remain relevant as foundational context

---
*Pitfalls research for: v1.5 new features — seed passthrough, plateau breaker, Medicare phase gate*
*Researched: 2026-02-22*
