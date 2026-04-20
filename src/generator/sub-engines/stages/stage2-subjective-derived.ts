/**
 * Stage 2: subjectiveDerived
 *
 * Severity (monotonic only-decrease), ADL items, frequency scheduling.
 *
 * RNG consumed (in order):
 *   1. _adlRng1 (placeholder, preserved for PRNG compatibility)
 *   2. _adlRng2 (placeholder, preserved for PRNG compatibility)
 *   3. _freqRng (placeholder, preserved for PRNG compatibility)
 *
 * Moved from src/generator/tx-sequence-engine.ts:1223-1302. Mutates
 * engineState.prevSeverity / prevPainForSeverity / prevAdlImproved /
 * prevAdlItemCount / prevSeverityForAdl / prevFrequency.
 */

import type {
  EngineConsts,
  EngineState,
  SeverityLevel,
  VisitAccumulator,
  SubjectiveDerivedFields,
  BodyPartKey,
  BaseVisitFields,
} from "../types";
import { reduceMuscles } from "../../muscle-selector";
import { getADLWeightsByMuscles } from "../../../shared/muscle-adl-affinity";
import { TEMPLATE_ADL } from "../../../shared/template-options";
import { severityFromPain, severityToCount } from "../shared-helpers";

/** Stage 2 populates both SubjectiveDerivedFields AND the frequency portion
 *  of BaseVisitFields. Returned here so the orchestrator can merge into acc. */
export function deriveSubjectiveDerived(args: {
  acc: Pick<
    VisitAccumulator,
    "painScaleCurrent" | "painDelta" | "painScaleLabel" | "visitIndex" | "progress" | "objectiveFactors"
  >;
  engineState: EngineState;
  consts: EngineConsts;
  stageRng: () => number;
}): SubjectiveDerivedFields &
  Pick<BaseVisitFields, "nextFrequency" | "frequencyImproved"> {
  const { acc, engineState, consts, stageRng } = args;
  const { goalPaths, context, initialMuscles } = consts;
  const i = acc.visitIndex;

  // Preserve rng() calls for PRNG sequence compatibility (was adlExpected + adlNoise)
  const _adlRng1 = 0.18 + stageRng() * 0.2;
  const _adlRng2 = (stageRng() - 0.5) * 0.12;
  void _adlRng1;
  void _adlRng2;

  // ADL tentative improvement (corrected later vs actual count)
  const adlADrop = goalPaths.adlA.changeVisits.includes(i);
  const adlBDrop = goalPaths.adlB.changeVisits.includes(i);
  let adlImproved = adlADrop || adlBDrop;

  // Severity: monotonic only-decrease, TX1 pinned to IE baseline
  const baseSeverity = severityFromPain(acc.painScaleCurrent);
  const severityOrder: SeverityLevel[] = [
    "mild",
    "mild to moderate",
    "moderate",
    "moderate to severe",
    "severe",
  ];
  let severityLevel = baseSeverity;
  if (i === consts.startIdx) {
    severityLevel = engineState.prevSeverity;
  }
  if (engineState.prevAdlImproved && acc.progress > 0.5) {
    const baseIdx = severityOrder.indexOf(baseSeverity);
    if (baseIdx > 0) {
      severityLevel = severityOrder[baseIdx - 1];
    }
  }
  const curSevIdx = severityOrder.indexOf(severityLevel);
  const prevSevIdx = severityOrder.indexOf(engineState.prevSeverity);
  if (curSevIdx > prevSevIdx && prevSevIdx >= 0) {
    severityLevel = engineState.prevSeverity;
  }
  const prevSeveritySnapshot = engineState.prevSeverity;
  engineState.prevSeverity = severityLevel;
  engineState.prevPainForSeverity = acc.painScaleCurrent;
  engineState.prevAdlImproved = adlImproved;

  // Muscle reduction (no RNG)
  const visitMuscles = reduceMuscles(initialMuscles, severityLevel);

  // ADL items
  const bp = context.primaryBodyPart as BodyPartKey;
  const validADL = new Set(TEMPLATE_ADL[bp] ?? []);
  const adlWeights = getADLWeightsByMuscles(
    visitMuscles.tightness as string[],
    context.primaryBodyPart,
  );
  const adlCount = severityToCount(engineState.prevSeverityForAdl, "adl");
  const adlItems = adlWeights
    .filter((w) => validADL.has(w.adl))
    .slice(0, adlCount)
    .map((w) => w.adl);

  // Correct adlImproved based on actual item count
  if (adlItems.length >= engineState.prevAdlItemCount) {
    adlImproved = false;
  }
  engineState.prevAdlItemCount = adlItems.length;
  engineState.prevSeverityForAdl = severityLevel;

  const aggravatingItems: string[] = [];

  // Frequency scheduling (RNG consumed HERE to match original order)
  const _freqRng = stageRng();
  void _freqRng;
  const freqIsScheduledDrop = goalPaths.frequency.changeVisits.includes(i);
  const nextFrequency = freqIsScheduledDrop
    ? Math.max(0, engineState.prevFrequency - 1)
    : engineState.prevFrequency;
  const frequencyImproved = nextFrequency < engineState.prevFrequency;
  engineState.prevFrequency = nextFrequency;

  return {
    severityLevel,
    prevSeveritySnapshot,
    visitMuscles,
    adlItems,
    adlImproved,
    aggravatingItems,
    nextFrequency,
    frequencyImproved,
  };
}
