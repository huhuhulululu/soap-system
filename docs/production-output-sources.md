# Production Output Sources

This document defines source-of-truth rules for SOAP text production.

## End-to-End Flow

1. `exportTXSeriesAsText(context, options)` calls `generateTXSequenceStates(...)`.
2. Engine produces per-visit `TXVisitState` (subjective/objective/assessment metadata).
3. `exportSOAPAsText(txContext, state)` renders text sections.
4. Renderer must consume `visitState` first and only fallback to weight/template inference when needed.

## Source Priority Rules

### TX Subjective

- Primary source: `visitState` (`symptomChange`, `reasonConnector`, `reason`, `painTypes`, `associatedSymptom`, `adlItems`, `painScaleLabel`, `painFrequency`, `symptomScale`).
- Secondary source: `context` (`painTypes`, `associatedSymptoms`, `painCurrent`, `painFrequency`, `symptomScale`).
- Last-resort fallback: `weight-system` and template defaults.

### TX Objective

- Primary source: `visitState` trends/grades and muscle groups (`soaChain.objective.*`, `strengthGrade`, `tightMuscles`, `tenderMuscles`, `spasmMuscles`, `tightnessGrading`, `tendernessGrading`, `spasmGrading`, `tonguePulse`, `inspection`).
- ROM rendering uses trend-aware selection (`pain + progress + romTrend`) via `pickTemplateROMDegreesByPain(...)`.
- Secondary source: `context` severity/pain when `visitState` is unavailable.
- Last-resort fallback: formula/template defaults.

### TX Assessment

- Primary source: `visitState.soaChain.assessment` as a full block.
- Rule: if assessment chain is complete, render all assessment fields from the chain to avoid mixed origins.
- Fallback source: `weight-system` for the whole assessment block when chain is unavailable.

### TX Plan

- Primary source: `visitState.treatmentFocus`.
- Secondary source: weight-selected verb from `plan.verb`.
- Treatment principle content source: `TCM_PATTERNS[context.localPattern].treatmentPrinciples[0]`.

### Needle Protocol

- Primary source: `visitState.needlePoints` grouped points (when available for grouped protocol paths).
- Secondary source: template pools by body part (`TEMPLATE_NEEDLE_POINTS` and insurance-time mapping).

### IE/RE Rendering

- IE/RE path does not use `visitState`; source is `context` + template pools + weighted selection.
- Note header labels are fixed by `context.noteType`:
  - `IE`/`NEW_IE` => `INITIAL EVALUATION`
  - `RE` => `RE-EVALUATION`
- `realisticPatch` post-process is scoped to IE/RE only.

## Cleanup Policy

- Avoid eager weight calculations if a primary source value is present.
- Avoid field-level multi-source mixing inside a single narrative block.
- Preserve backward-compatible fallback only for missing data, not as parallel competing sources.
- TX path remains single-source (`engine -> renderer`) with no batch-level post patch mutation.

## Dynamic Audit Notes

- Run dynamic consistency audit with `npm run audit:dynamic` (internally uses `node --import tsx` for better sandbox compatibility).
- `mixedDirectionEmptyFindingType` is expected by current design:
  - When both reduce-direction and increase-direction findings exist in the same visit, details are embedded in `physicalChange`.
  - `findingType` may be intentionally empty in this mixed-direction case to avoid duplicated wording in rendered assessment text.
- `romTrendNoRomChange` is only counted for comparable visits where both sides produced parsable ROM degree arrays with the same length.
