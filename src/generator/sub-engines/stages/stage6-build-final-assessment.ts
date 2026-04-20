/**
 * Stage 6: buildFinalAssessment
 *
 * After Stage 5 display reconciliation, recompute trends based on *displayed*
 * grading (not internal numeric), derive dimScore on those reconciled trends,
 * enforce the final S-O guard, and produce the assessment fragment.
 *
 * Moved from src/generator/tx-sequence-engine.ts:2010-2168. Pure — no RNG,
 * no state mutation (visits[] is pushed by the orchestrator after this stage).
 */

import type {
  EngineConsts,
  EngineState,
  VisitAccumulator,
  FinalAssessmentFields,
  Trend,
} from "../types";
import {
  computeDimensionScore,
  deriveAssessmentFromSOA,
} from "../shared-helpers";

const parseTenderGrade = (grading: string): number => {
  if (grading === "0") return 0;
  const n = parseInt(grading.replace("+", ""), 10);
  return isNaN(n) ? 2 : n;
};
const parseSpasmGrade = (grading: string): number => {
  if (grading.includes("(0)")) return 0;
  const m = grading.match(/\+(\d)/);
  return m ? parseInt(m[1], 10) : 0;
};
const tightGradeOrder = (grade: string): number => {
  const TIGHTNESS_ORDER = [
    "mild",
    "mild to moderate",
    "moderate",
    "moderate to severe",
    "severe",
  ];
  const idx = TIGHTNESS_ORDER.indexOf(grade.toLowerCase());
  return idx >= 0 ? idx + 1 : 3;
};

export function buildFinalAssessment(args: {
  acc: Pick<
    VisitAccumulator,
    | "display"
    | "painDelta"
    | "severityLevel"
    | "prevSeveritySnapshot"
    | "adlImproved"
    | "adlDelta"
    | "progress"
    | "painScaleCurrent"
    | "visitIndex"
    | "associatedSymptom"
    | "romTrend"
    | "strengthTrend"
    | "tightnessTrend"
    | "tendernessTrend"
    | "spasmTrend"
    | "cumulativePainDrop"
    | "symptomChange"
  >;
  engineState: EngineState;
  consts: EngineConsts;
}): FinalAssessmentFields {
  const { acc, engineState, consts } = args;
  const prevVisit =
    engineState.visits.length > 0
      ? engineState.visits[engineState.visits.length - 1]
      : undefined;

  const finalSymptomScaleChanged = prevVisit
    ? acc.display.visitSymptomScale !== prevVisit.symptomScale
    : acc.display.visitSymptomScale !==
      (consts.options.initialState?.symptomScale || "70%");
  const finalFrequencyImproved =
    acc.display.chainFrequency !==
    (prevVisit?.painFrequency ?? consts.initialFrequencyLabel);

  let finalTightnessTrend: Trend = acc.tightnessTrend;
  let finalTendernessTrend: Trend = acc.tendernessTrend;
  let finalSpasmTrend: Trend = acc.spasmTrend;
  if (prevVisit) {
    finalTightnessTrend =
      tightGradeOrder(acc.display.tightnessGrading) <
      tightGradeOrder(prevVisit.tightnessGrading)
        ? "reduced"
        : "stable";
    const currentTenderGrade = acc.display.tendernessGrading.match(/\+(\d)/)?.[1]
      ? `+${acc.display.tendernessGrading.match(/\+(\d)/)?.[1]}`
      : "0";
    const prevTenderGrade = prevVisit.tendernessGrading.match(/\+(\d)/)?.[1]
      ? `+${prevVisit.tendernessGrading.match(/\+(\d)/)?.[1]}`
      : "0";
    finalTendernessTrend =
      parseTenderGrade(currentTenderGrade) < parseTenderGrade(prevTenderGrade)
        ? "reduced"
        : "stable";
    finalSpasmTrend =
      parseSpasmGrade(acc.display.spasmGrading) <
      parseSpasmGrade(prevVisit.spasmGrading)
        ? "reduced"
        : "stable";
  }

  const finalDimScore = computeDimensionScore({
    painDelta: acc.painDelta,
    symptomScaleChanged: finalSymptomScaleChanged,
    severityChanged: acc.severityLevel !== acc.prevSeveritySnapshot,
    frequencyImproved: finalFrequencyImproved,
    adlImproved: acc.adlImproved,
    tightnessTrend: finalTightnessTrend,
    tendernessTrend: finalTendernessTrend,
    spasmTrend: finalSpasmTrend,
    romTrend: acc.romTrend,
    strengthTrend: acc.strengthTrend,
  });

  const hasFinalObjectiveChange =
    finalTightnessTrend !== "stable" ||
    finalTendernessTrend !== "stable" ||
    finalSpasmTrend !== "stable" ||
    acc.romTrend !== "stable" ||
    acc.strengthTrend !== "stable";

  const painDroppedFromPrev = prevVisit
    ? acc.painScaleCurrent < prevVisit.painScaleCurrent
    : acc.painScaleCurrent < consts.startPain;

  const hasSubjectiveImprovementSignal =
    hasFinalObjectiveChange || painDroppedFromPrev;

  // Final S-O guard: "improvement" must be backed by objective change or pain drop.
  let finalSymptomChange = acc.symptomChange;
  if (
    acc.symptomChange.includes("improvement") &&
    !hasFinalObjectiveChange &&
    !painDroppedFromPrev
  ) {
    finalSymptomChange = "improvement of symptom(s)";
  }

  const assessmentFromChain = deriveAssessmentFromSOA({
    painDelta: acc.painDelta,
    adlDelta: acc.adlDelta,
    frequencyImproved: finalFrequencyImproved,
    visitIndex: acc.visitIndex,
    objectiveTightnessTrend: finalTightnessTrend,
    objectiveTendernessTrend: finalTendernessTrend,
    objectiveSpasmTrend: finalSpasmTrend,
    objectiveRomTrend: acc.romTrend,
    objectiveStrengthTrend: acc.strengthTrend,
    cumulativePainDrop: acc.cumulativePainDrop,
    progress: acc.progress,
    bodyPart: consts.context.primaryBodyPart || "LBP",
    dimScore: finalDimScore.score,
    changedDims: finalDimScore.changedDims,
    associatedSymptom: acc.associatedSymptom,
    symptomScaleChanged: finalSymptomScaleChanged,
    severityChanged: acc.severityLevel !== acc.prevSeveritySnapshot,
  });

  const soaChain = {
    subjective: {
      painChange: hasSubjectiveImprovementSignal
        ? ("improved" as const)
        : finalSymptomChange.includes("exacerbate") ||
            finalSymptomChange.includes("came back")
          ? ("worsened" as const)
          : ("similar" as const),
      adlChange: acc.adlImproved
        ? ("improved" as const)
        : ("stable" as const),
      frequencyChange: finalFrequencyImproved
        ? ("improved" as const)
        : ("stable" as const),
    },
    objective: {
      tightnessTrend: finalTightnessTrend,
      tendernessTrend: finalTendernessTrend,
      spasmTrend: finalSpasmTrend,
      romTrend: acc.romTrend,
      strengthTrend: acc.strengthTrend,
    },
    assessment:
      finalDimScore.score === 0
        ? { ...assessmentFromChain, present: "no change." }
        : assessmentFromChain,
  };

  return {
    finalTightnessTrend,
    finalTendernessTrend,
    finalSpasmTrend,
    finalFrequencyImproved,
    finalSymptomScaleChanged,
    finalDimScore,
    hasFinalObjectiveChange,
    hasSubjectiveImprovementSignal,
    finalSymptomChange,
    assessmentFromChain,
    soaChain,
  };
}
