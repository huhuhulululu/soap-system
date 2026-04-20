/**
 * Stage 4: objectiveState — numeric + grading text.
 *
 * Original code interleaves objective (tight/tender/spasm/ROM/strength)
 * WITH narrative (Stage 3): numeric first (1304-1485), then narrative
 * (1487-1771), then grading text + needle + chainFrequency + visitSymptomScale
 * (1773-1947). To preserve the main PRNG sequence byte-identically, we
 * split Stage 4 into two halves that the orchestrator bookends around
 * Stage 3:
 *
 *   Stage 4a: deriveObjectiveNumeric   (tight/tender/spasm numeric +
 *                                       ROM + strength + plateau +
 *                                       sideProgress)
 *   Stage 3:  buildSubjectiveNarrative (symptomChange/reason/etc.)
 *   Stage 4b: buildObjectiveGrading    (grading text + needle +
 *                                       chainFrequency + visitSymptomScale)
 *
 * Moved from src/generator/tx-sequence-engine.ts:1304-1485 and 1773-1947
 * during B1.4.
 */

import type {
  EngineConsts,
  EngineState,
  VisitAccumulator,
  ObjectiveStateFields,
  Trend,
  RomStrengthTrend,
  BodyPartKey,
} from "../types";
import type { NeedleGroups } from "../../../shared/template-options";
import {
  TEMPLATE_TENDERNESS_SCALE,
  NEEDLE_GROUP_SIZES,
  TEMPLATE_NEEDLE_POINTS,
} from "../../../shared/template-options";
import {
  STRENGTH_LADDER,
} from "../../../shared/strength-table";
import {
  clamp,
  findTemplateOption,
  pickMultiple,
  selectNeedleGroups,
  snapPainToGrid,
  snapSymptomToGrid,
} from "../shared-helpers";

// ═════════════════════════════════════════════════════════════════════
// Stage 4a — objective numeric (tight/tender/spasm + ROM/strength + plateau + side)
// ═════════════════════════════════════════════════════════════════════

type NumericOutput = Pick<
  ObjectiveStateFields,
  | "nextTightness"
  | "nextTenderness"
  | "nextSpasm"
  | "tightnessBounced"
  | "tendernessBounced"
  | "spasmBounced"
  | "nextRomDeficit"
  | "nextStrengthLevel"
  | "strengthGrade"
  | "tightnessTrend"
  | "tendernessTrend"
  | "spasmTrend"
  | "romTrend"
  | "strengthTrend"
  | "sideProgress"
>;

export function deriveObjectiveNumeric(args: {
  acc: Pick<
    VisitAccumulator,
    | "painScaleCurrent"
    | "painScaleLabel"
    | "painDelta"
    | "visitIndex"
    | "progress"
    | "frequencyImproved"
  >;
  engineState: EngineState;
  consts: EngineConsts;
}): NumericOutput {
  const { acc, engineState, consts } = args;
  const { rng, txCount, goalPaths, chronicCapsEnabled, context } = consts;
  const i = acc.visitIndex;

  // Context for grading computations
  const snappedForGrade = snapPainToGrid(acc.painScaleCurrent);
  void snappedForGrade;

  // --- Tightness ---
  const bounceRng = rng();
  const bounceEnabled =
    txCount >= 12 && i > Math.max(3, Math.round(goalPaths.stBoundary * 0.6));
  const bounceProbability = 0.25;
  let nextTightness: number;
  let tightnessBounced = false;
  const tightIsScheduledDrop = goalPaths.tightness.changeVisits.includes(i);
  if (tightIsScheduledDrop) {
    const baseline = engineState.prevTightnessBounced
      ? engineState.prevTightness - 1
      : engineState.prevTightness;
    nextTightness = Math.max(1, baseline - 1);
  } else if (engineState.prevTightnessBounced) {
    nextTightness = Math.max(1, engineState.prevTightness - 1);
  } else if (
    bounceEnabled &&
    bounceRng < bounceProbability &&
    engineState.prevTightness <= goalPaths.tightness.stGoal &&
    !goalPaths.tightness.changeVisits.includes(i + 1) &&
    i < txCount
  ) {
    nextTightness = engineState.prevTightness + 1;
    tightnessBounced = true;
  } else {
    nextTightness = engineState.prevTightness;
  }
  engineState.prevTightnessBounced = tightnessBounced;

  // --- Tenderness ---
  const tenderBounceRng = rng();
  let nextTenderness: number;
  let tendernessBounced = false;
  const tenderIsScheduledDrop = goalPaths.tenderness.changeVisits.includes(i);
  if (tenderIsScheduledDrop) {
    const baseline = engineState.prevTendernessBounced
      ? engineState.prevTenderness - 1
      : engineState.prevTenderness;
    nextTenderness = Math.max(1, baseline - 1);
  } else if (engineState.prevTendernessBounced) {
    nextTenderness = Math.max(1, engineState.prevTenderness - 1);
  } else if (
    bounceEnabled &&
    tenderBounceRng < bounceProbability &&
    engineState.prevTenderness <= goalPaths.tenderness.stGoal &&
    !goalPaths.tenderness.changeVisits.includes(i + 1) &&
    i < txCount
  ) {
    nextTenderness = engineState.prevTenderness + 1;
    tendernessBounced = true;
  } else {
    nextTenderness = engineState.prevTenderness;
  }
  engineState.prevTendernessBounced = tendernessBounced;

  let tightnessTrend: Trend =
    nextTightness < engineState.prevTightness ? "reduced" : "stable";
  let tendernessTrend: Trend =
    nextTenderness < engineState.prevTenderness ? "reduced" : "stable";
  engineState.prevTightness = nextTightness;
  engineState.prevTenderness = nextTenderness;

  // --- Spasm (no bounce) ---
  const spasmBounceRng = rng();
  void spasmBounceRng;
  let nextSpasm: number;
  const spasmBounced = false;
  const spasmIsScheduledDrop = goalPaths.spasm.changeVisits.includes(i);
  if (spasmIsScheduledDrop) {
    const baseline = engineState.prevSpasmBounced
      ? engineState.prevSpasm - 1
      : engineState.prevSpasm;
    nextSpasm = Math.max(0, baseline - 1);
  } else if (engineState.prevSpasmBounced) {
    nextSpasm = Math.max(0, engineState.prevSpasm - 1);
  } else {
    nextSpasm = engineState.prevSpasm;
  }
  engineState.prevSpasmBounced = spasmBounced;
  // Consume rng() to maintain PRNG sequence
  rng();
  let spasmTrend: Trend =
    nextSpasm < engineState.prevSpasm ? "reduced" : "stable";
  engineState.prevSpasm = nextSpasm;

  // --- ROM / Strength ---
  const romDampener = chronicCapsEnabled ? 0.75 : 0.85;
  const strengthDampener = chronicCapsEnabled ? 0.7 : 0.95;
  const romProgress = acc.progress * romDampener;
  const strengthProgress = romProgress * strengthDampener;
  void strengthProgress;

  const nextRomDeficit = clamp(
    Math.min(
      engineState.prevRomDeficit,
      engineState.prevRomDeficit -
        (0.03 + rng() * 0.05) * (romProgress > 0.2 ? 1 : 0.3),
    ),
    0.08,
    0.6,
  );
  // Preserve rng() call for PRNG sequence compatibility
  const _strengthRng = 0.02 + rng() * 0.04;
  void _strengthRng;

  const strengthIsScheduledRise =
    goalPaths.strength.changeVisits.includes(i);
  const nextStrengthLevel = strengthIsScheduledRise
    ? Math.min(engineState.prevStrengthLevel + 1, STRENGTH_LADDER.length - 1)
    : engineState.prevStrengthLevel;
  const strengthGrade =
    STRENGTH_LADDER[nextStrengthLevel] ??
    STRENGTH_LADDER[engineState.prevStrengthLevel];

  let romTrend: RomStrengthTrend =
    nextRomDeficit < engineState.prevRomDeficit - 0.055
      ? "improved"
      : nextRomDeficit < engineState.prevRomDeficit
        ? "slightly improved"
        : "stable";
  let strengthTrend: RomStrengthTrend =
    nextStrengthLevel > engineState.prevStrengthLevel ? "improved" : "stable";

  // --- Plateau conditioning ---
  const anyDimChanged =
    tightnessTrend !== "stable" ||
    tendernessTrend !== "stable" ||
    spasmTrend !== "stable" ||
    acc.frequencyImproved ||
    acc.painDelta > 0.2;
  const plateau =
    !anyDimChanged &&
    acc.painScaleLabel === engineState.prevPainScaleLabel &&
    acc.progress > 0.5;
  if (plateau) {
    if (acc.progress > 0.7) {
      if (rng() > 0.5) {
        strengthTrend = "stable";
      } else {
        romTrend = "stable";
      }
    } else {
      romTrend = "stable";
      strengthTrend = "stable";
    }
  }

  // --- ROM trend gated by pain label change ---
  const painLabelChanged = acc.painScaleLabel !== engineState.prevPainScaleLabel;
  if (!painLabelChanged) {
    romTrend = "stable";
  } else {
    const romStrictBodyPart = new Set([
      "MID_LOW_BACK",
      "MIDDLE_BACK",
      "UPPER_BACK",
    ]).has(context.primaryBodyPart || "");
    const improvedMinDelta = romStrictBodyPart ? 0.75 : 0.55;
    const slightMinDelta = romStrictBodyPart ? 0.8 : 0.6;

    if (romTrend === "improved" && acc.painDelta < improvedMinDelta) {
      romTrend = "slightly improved";
    }
    if (romTrend === "slightly improved" && acc.painDelta < slightMinDelta) {
      romTrend = "stable";
    }
  }

  engineState.prevPainScaleLabel = acc.painScaleLabel;
  engineState.prevRomDeficit = nextRomDeficit;
  engineState.prevStrengthLevel = nextStrengthLevel;

  // --- Bilateral sideProgress ---
  const isBilateral = context.laterality === "bilateral";
  let sideProgress: ObjectiveStateFields["sideProgress"] | undefined = undefined;
  if (isBilateral) {
    const asym = 0.06 + rng() * 0.12;
    const dominantLeft = i % 2 === 0;
    const left = clamp(
      acc.progress + (dominantLeft ? asym : -asym),
      0.01,
      0.99,
    );
    const right = clamp(
      acc.progress + (dominantLeft ? -asym : asym),
      0.01,
      0.99,
    );
    sideProgress = { left, right };
  }

  return {
    nextTightness,
    nextTenderness,
    nextSpasm,
    tightnessBounced,
    tendernessBounced,
    spasmBounced,
    nextRomDeficit,
    nextStrengthLevel,
    strengthGrade,
    tightnessTrend,
    tendernessTrend,
    spasmTrend,
    romTrend,
    strengthTrend,
    sideProgress,
  };
}

// ═════════════════════════════════════════════════════════════════════
// Stage 4b — objective grading text + needle + chainFrequency + visitSymptomScale
// ═════════════════════════════════════════════════════════════════════

type GradingOutput = Pick<
  ObjectiveStateFields,
  | "tightnessGrading"
  | "tendernessGrading"
  | "spasmGrading"
  | "needlePoints"
  | "chainFrequency"
  | "visitSymptomScale"
  | "cumulativePainDrop"
  | "adlDelta"
> & {
  // Stage 4b may reconcile trends against displayed grading
  tightnessTrend: Trend;
  tendernessTrend: Trend;
  spasmTrend: Trend;
};

export function buildObjectiveGrading(args: {
  acc: Pick<
    VisitAccumulator,
    | "visitIndex"
    | "painScaleCurrent"
    | "painDelta"
    | "progress"
    | "nextTightness"
    | "nextTenderness"
    | "nextSpasm"
    | "tightnessTrend"
    | "tendernessTrend"
    | "spasmTrend"
    | "romTrend"
    | "strengthTrend"
    | "ruleContext"
    | "adlImproved"
    | "symptomChange"
    | "painFrequency"
  >;
  engineState: EngineState;
  consts: EngineConsts;
}): GradingOutput {
  const { acc, engineState, consts } = args;
  const { rng, context } = consts;
  const i = acc.visitIndex;

  // --- Tightness grading ---
  const TIGHTNESS_ORDER = [
    "mild",
    "mild to moderate",
    "moderate",
    "moderate to severe",
    "severe",
  ];
  // Consume rng() to maintain PRNG sequence (was used by old ceiling/jitter logic)
  rng();
  rng();
  const tightnessIdx = Math.max(0, Math.min(4, acc.nextTightness - 1));
  let tightnessGrading = TIGHTNESS_ORDER[tightnessIdx]
    .split(" ")
    .map((w, wi) =>
      wi === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w,
    )
    .join(" ");
  if (engineState.prevTightnessGrading !== "") {
    const prevIdx = TIGHTNESS_ORDER.indexOf(
      engineState.prevTightnessGrading.toLowerCase(),
    );
    const curIdx = TIGHTNESS_ORDER.indexOf(tightnessGrading.toLowerCase());
    if (prevIdx >= 0 && curIdx > prevIdx) {
      tightnessGrading = engineState.prevTightnessGrading;
    }
  }
  const tightGradeOrder = (grade: string): number => {
    const idx = TIGHTNESS_ORDER.indexOf(grade.toLowerCase());
    return idx >= 0 ? idx + 1 : 3;
  };
  const displayedTightnessOrder = tightGradeOrder(tightnessGrading);
  let tightnessTrend: Trend = acc.tightnessTrend;
  if (i > 0 && engineState.visits.length > 0) {
    const prevDisplayedTightness = tightGradeOrder(
      engineState.visits[engineState.visits.length - 1].tightnessGrading ??
        tightnessGrading,
    );
    tightnessTrend =
      displayedTightnessOrder < prevDisplayedTightness ? "reduced" : "stable";
  }
  engineState.prevTightnessGrading = tightnessGrading;

  // --- Tenderness grading ---
  const bpTenderScale =
    TEMPLATE_TENDERNESS_SCALE[context.primaryBodyPart as BodyPartKey] ||
    TEMPLATE_TENDERNESS_SCALE.LBP;
  const tenderGradeOrder = (grade: string): number => {
    if (grade === "0") return 0;
    const n = parseInt(grade.replace("+", ""), 10);
    return isNaN(n) ? 2 : n;
  };
  rng();
  rng();
  const targetTenderGrade =
    acc.nextTenderness === 0 ? "0" : "+" + acc.nextTenderness;
  let tendernessGrading =
    bpTenderScale[targetTenderGrade] ||
    bpTenderScale["+2"] ||
    "(+2) = Patient states that the area is moderately tender";
  if (engineState.prevTendernessGrade !== "") {
    const prevOrder = tenderGradeOrder(engineState.prevTendernessGrade);
    const curOrder = tenderGradeOrder(targetTenderGrade);
    if (curOrder > prevOrder) {
      tendernessGrading =
        bpTenderScale[engineState.prevTendernessGrade] || tendernessGrading;
    } else {
      engineState.prevTendernessGrade = targetTenderGrade;
    }
  } else {
    engineState.prevTendernessGrade = targetTenderGrade;
  }

  const displayedTenderNum = parseInt(
    engineState.prevTendernessGrade.replace("+", ""),
  );
  let tendernessTrend: Trend = acc.tendernessTrend;
  if (i > 0 && engineState.visits.length > 0) {
    const prevDisplayedTender = parseInt(
      engineState.visits[engineState.visits.length - 1].tendernessGrading.match(
        /\+(\d)/,
      )?.[1] ?? String(displayedTenderNum),
    );
    if (displayedTenderNum < prevDisplayedTender) {
      tendernessTrend = "reduced";
    } else {
      tendernessTrend = "stable";
    }
  }

  // --- Needle group inheritance (first visit only) ---
  if (!engineState.fixedNeedleGroups) {
    const _legacyPick = pickMultiple(
      "plan.needleProtocol.points",
      6,
      acc.ruleContext as Parameters<typeof pickMultiple>[2],
      acc.progress,
      rng,
    );
    const groupSeed =
      _legacyPick.length > 0
        ? _legacyPick.join("").split("").reduce((s, c) => s + c.charCodeAt(0), 0)
        : i + 1;
    engineState.fixedNeedleGroups = selectNeedleGroups(
      (context.primaryBodyPart || "LBP") as BodyPartKey,
      groupSeed,
    );
  }
  const needlePoints: NeedleGroups = engineState.fixedNeedleGroups;

  // --- Spasm grading + trend reconcile ---
  const SPASM_TEXTS = [
    "(0)=No spasm",
    "(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.",
    "(+2)=Occasional spontaneous spasms and easily induced spasms.",
    "(+3)=>1 but < 10 spontaneous spasms per hour.",
    "(+4)=>10 spontaneous spasms per hour.",
  ];
  const spasmGrading = SPASM_TEXTS[acc.nextSpasm] || SPASM_TEXTS[3];

  let spasmTrend: Trend = acc.spasmTrend;
  if (i > 0 && engineState.visits.length > 0) {
    const prevDisplayedSpasm = parseInt(
      engineState.visits[engineState.visits.length - 1].spasmGrading.match(
        /\+(\d)/,
      )?.[1] ?? String(acc.nextSpasm),
    );
    if (acc.nextSpasm < prevDisplayedSpasm) {
      spasmTrend = "reduced";
    } else {
      spasmTrend = "stable";
    }
  }

  void TEMPLATE_NEEDLE_POINTS;
  void NEEDLE_GROUP_SIZES;

  // --- chainFrequency (text label) ---
  const frequencyByLevel = [
    "Intermittent (symptoms occur less than 25% of the time)",
    "Occasional (symptoms occur between 26% and 50% of the time)",
    "Frequent (symptoms occur between 51% and 75% of the time)",
    "Constant (symptoms occur between 76% and 100% of the time)",
  ];
  const chainFrequency = findTemplateOption(
    "subjective.painFrequency",
    [frequencyByLevel[engineState.prevFrequency]],
    acc.painFrequency,
  );

  // --- cumulativePainDrop / adlDelta ---
  const cumulativePainDrop = consts.startPain - acc.painScaleCurrent;
  const adlDelta = acc.adlImproved ? 1 : 0;

  // --- visitSymptomScale (may update prevSymptomDecade) ---
  const symptomDrop = consts.goalPaths.symptomScale.changeVisits.includes(i);
  if (symptomDrop) {
    engineState.prevSymptomDecade = Math.max(
      1,
      engineState.prevSymptomDecade - 1,
    );
  }
  const visitSymptomScale = snapSymptomToGrid(
    engineState.prevSymptomDecade * 10,
  );

  return {
    tightnessGrading,
    tendernessGrading,
    spasmGrading,
    needlePoints,
    chainFrequency,
    visitSymptomScale,
    cumulativePainDrop,
    adlDelta,
    tightnessTrend,
    tendernessTrend,
    spasmTrend,
  };
}
