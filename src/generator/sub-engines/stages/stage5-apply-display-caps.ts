/**
 * Stage 5: applyDisplayCaps
 *
 * Cap output-layer changes at OUTPUT_CAP=4 per visit, deferring low-priority
 * dimensions by reverting them to the previous visit's value. Pure function
 * over inputs + EngineState.visits; no RNG, no state mutation.
 *
 * Moved from src/generator/tx-sequence-engine.ts:1949-2008 during B1.4.
 */

import type { EngineState, VisitAccumulator, VisitDisplay } from "../types";

const OUTPUT_CAP = 4;

/** Returns the display sub-object (5 cap-revertable fields). Strength is
 *  never deferred (ladder index cannot cleanly roll back). */
export function applyDisplayCaps(args: {
  acc: Pick<
    VisitAccumulator,
    | "painScaleCurrent"
    | "severityLevel"
    | "strengthGrade"
    | "adlItems"
    | "tightnessGrading"
    | "tendernessGrading"
    | "spasmGrading"
    | "chainFrequency"
    | "visitSymptomScale"
  >;
  engineState: EngineState;
}): { display: VisitDisplay } {
  const { acc, engineState } = args;

  // Baseline: display = true state as produced by stage 4
  let tightnessGrading = acc.tightnessGrading;
  let tendernessGrading = acc.tendernessGrading;
  let spasmGrading = acc.spasmGrading;
  let chainFrequency = acc.chainFrequency;
  let visitSymptomScale = acc.visitSymptomScale;

  if (engineState.visits.length > 0) {
    const prev = engineState.visits[engineState.visits.length - 1];

    const outputChanges: string[] = [];
    if (acc.painScaleCurrent !== prev.painScaleCurrent)
      outputChanges.push("pain");
    if (acc.severityLevel !== prev.severityLevel) outputChanges.push("sev");
    if (visitSymptomScale !== prev.symptomScale)
      outputChanges.push("symScale");
    if (chainFrequency !== prev.painFrequency) outputChanges.push("freq");
    if (acc.strengthGrade !== prev.strengthGrade) outputChanges.push("str");
    if (acc.adlItems.length !== (prev.adlItems?.length ?? 0))
      outputChanges.push("adl");
    if (tightnessGrading !== prev.tightnessGrading)
      outputChanges.push("tight");
    if (tendernessGrading !== prev.tendernessGrading)
      outputChanges.push("tend");
    if (spasmGrading !== prev.spasmGrading) outputChanges.push("spasm");

    if (outputChanges.length > OUTPUT_CAP) {
      // Defer lowest-priority goalPaths dims by reverting to previous values.
      // Priority (defer first → last): spasm, tenderness, tightness, strength, frequency, symptomScale
      // Never defer: pain, severity, adl (cascade-critical)
      const deferOrder = [
        "spasm",
        "tend",
        "tight",
        "str",
        "freq",
        "symScale",
      ];
      let excess = outputChanges.length - OUTPUT_CAP;
      for (const dim of deferOrder) {
        if (excess <= 0) break;
        if (!outputChanges.includes(dim)) continue;
        switch (dim) {
          case "spasm":
            spasmGrading = prev.spasmGrading;
            break;
          case "tend":
            tendernessGrading = prev.tendernessGrading;
            break;
          case "tight":
            tightnessGrading = prev.tightnessGrading;
            break;
          case "str": // strength can't easily revert (ladder index), skip
            continue;
          case "freq":
            chainFrequency = prev.painFrequency;
            break;
          case "symScale":
            visitSymptomScale = prev.symptomScale ?? visitSymptomScale;
            break;
        }
        excess--;
      }
    }
  }

  return {
    display: {
      tightnessGrading,
      tendernessGrading,
      spasmGrading,
      chainFrequency,
      visitSymptomScale,
    },
  };
}
