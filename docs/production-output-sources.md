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

- Primary source: `visitState` trends and grades (`soaChain.objective.*`, `strengthGrade`, `tightness/tenderness/spasm`, `tonguePulse`, `inspection`).
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

## Cleanup Policy

- Avoid eager weight calculations if a primary source value is present.
- Avoid field-level multi-source mixing inside a single narrative block.
- Preserve backward-compatible fallback only for missing data, not as parallel competing sources.
