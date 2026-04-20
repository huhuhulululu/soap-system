/**
 * Stage 3: subjectiveNarrative
 *
 * symptomChange (multi-round corrections), reason + connector (shuffle bag),
 * associatedSymptoms, painFrequency (pickSingle), treatmentFocus, generalCondition.
 *
 * Orchestrator sequencing: runs AFTER Stage 4a (objective numeric) and BEFORE
 * Stage 4b (objective grading) to preserve the original PRNG order.
 *
 * Moved from src/generator/tx-sequence-engine.ts:1487-1771.
 */

import type {
  EngineConsts,
  EngineState,
  VisitAccumulator,
  SubjectiveNarrativeFields,
} from "../types";
import type { RuleContext } from "../../../parser/rule-engine";
import { TEMPLATE_TX_REASON } from "../../../shared/template-options";
import {
  buildRuleContext,
  computeDimensionScore,
  pickSingle,
  snapSymptomToGrid,
} from "../shared-helpers";

export function buildSubjectiveNarrative(args: {
  acc: Pick<
    VisitAccumulator,
    | "visitIndex"
    | "painScaleCurrent"
    | "painDelta"
    | "progress"
    | "severityLevel"
    | "prevSeveritySnapshot"
    | "adlImproved"
    | "frequencyImproved"
    | "tightnessTrend"
    | "tendernessTrend"
    | "spasmTrend"
    | "romTrend"
    | "strengthTrend"
  >;
  engineState: EngineState;
  consts: EngineConsts;
  stageRng: () => number;
}): SubjectiveNarrativeFields {
  const { acc, engineState, consts, stageRng } = args;
  const { context, goalPaths, options, baselineAssociatedSymptoms } = consts;
  const i = acc.visitIndex;

  const ruleContext = buildRuleContext(
    context,
    acc.painScaleCurrent,
    acc.severityLevel,
  );

  // --- Phase 1: initial symptomChange pick ---
  let symptomChange = pickSingle(
    "subjective.symptomChange",
    ruleContext,
    acc.progress,
    stageRng,
    "improvement of symptom(s)",
  );
  if (symptomChange.includes("similar")) {
    symptomChange = "improvement of symptom(s)";
  }

  // --- Negative events gate ---
  const isNegativeSC =
    symptomChange.includes("exacerbate") ||
    symptomChange.includes("came back");
  if (isNegativeSC) {
    if (!context.allowNegativeEvents || i === consts.startIdx) {
      symptomChange = "improvement of symptom(s)";
    } else {
      const negativeRoll = stageRng();
      if (negativeRoll > 0.1) {
        symptomChange = "improvement of symptom(s)";
      }
    }
  }

  // --- T02/T03 hard guard: dimScore-driven correction ---
  // symptomScaleChanged uses pending display value (pre-cap)
  const pendingSymptomDecade = goalPaths.symptomScale.changeVisits.includes(i)
    ? Math.max(1, engineState.prevSymptomDecade - 1)
    : engineState.prevSymptomDecade;
  const pendingSymptomScale = snapSymptomToGrid(pendingSymptomDecade * 10);
  const prevVisitSymptomScale =
    engineState.visits.length > 0
      ? engineState.visits[engineState.visits.length - 1].symptomScale
      : options.initialState?.symptomScale || "70%";
  const symptomScaleChanged = pendingSymptomScale !== prevVisitSymptomScale;
  const severityChanged = acc.severityLevel !== acc.prevSeveritySnapshot;

  const dimScore = computeDimensionScore({
    painDelta: acc.painDelta,
    symptomScaleChanged,
    severityChanged,
    frequencyImproved: acc.frequencyImproved,
    adlImproved: acc.adlImproved,
    tightnessTrend: acc.tightnessTrend,
    tendernessTrend: acc.tendernessTrend,
    spasmTrend: acc.spasmTrend,
    romTrend: acc.romTrend,
    strengthTrend: acc.strengthTrend,
  });

  if (dimScore.score === 0) {
    if (!symptomChange.includes("improvement of symptom")) {
      symptomChange = "improvement of symptom(s)";
    }
  } else if (dimScore.score >= 0.15 && symptomChange.includes("exacerbate")) {
    symptomChange = "improvement of symptom(s)";
  }

  if (
    acc.progress > 0.7 &&
    dimScore.score > 0 &&
    !symptomChange.includes("improvement of symptom")
  ) {
    symptomChange = "improvement of symptom(s)";
  }

  // --- Phase 2: reason + connector pick ---
  const reasonRuleContext: RuleContext = {
    ...ruleContext,
    subjective: { ...ruleContext.subjective, symptomChange },
  };
  const reasonConnector = pickSingle(
    "subjective.reasonConnector",
    reasonRuleContext,
    acc.progress,
    stageRng,
    "because of",
  );
  const reason = pickSingle(
    "subjective.reason",
    reasonRuleContext,
    acc.progress,
    stageRng,
    "energy level improved",
  );

  const isImprovement =
    symptomChange.includes("improvement") &&
    !symptomChange.includes("came back");
  const isExacerbate = symptomChange.includes("exacerbate");
  const isCameBack = symptomChange.includes("came back");

  const POSITIVE_TEMPLATE_REASONS = TEMPLATE_TX_REASON.filter((_, i) => i < 8);
  const NEGATIVE_TEMPLATE_REASONS = TEMPLATE_TX_REASON.filter(
    (_, i) => i >= 15 && i <= 22,
  );
  const NEUTRAL_TEMPLATE_REASONS = TEMPLATE_TX_REASON.filter(
    (_, i) => i >= 8 && i <= 14,
  );
  void NEUTRAL_TEMPLATE_REASONS;

  const isAdlReason = (r: string): boolean =>
    r.includes("daily activities") || r.includes("physical activity");
  const isPainReason = (r: string): boolean => r.includes("pain");
  const allowPositiveReason = (r: string): boolean => {
    if (!acc.adlImproved && isAdlReason(r)) return false;
    if (acc.painDelta <= 0.2 && isPainReason(r)) return false;
    return true;
  };

  const positivePoolPriority = [
    ...(acc.painDelta > 0.2
      ? POSITIVE_TEMPLATE_REASONS.filter(
          (r) =>
            (r.includes("pain") ||
              r.includes("joint") ||
              r.includes("stiffness")) &&
            allowPositiveReason(r),
        )
      : []),
    ...(acc.adlImproved
      ? POSITIVE_TEMPLATE_REASONS.filter(
          (r) =>
            (r.includes("daily") || r.includes("activity")) &&
            allowPositiveReason(r),
        )
      : []),
    ...POSITIVE_TEMPLATE_REASONS.filter(
      (r) =>
        (r.includes("energy") || r.includes("sleep")) &&
        allowPositiveReason(r),
    ),
  ];
  const positivePool = Array.from(new Set(positivePoolPriority));
  const MIN_POSITIVE_POOL = 5;
  if (positivePool.length < MIN_POSITIVE_POOL) {
    for (const reasonOption of POSITIVE_TEMPLATE_REASONS) {
      if (!allowPositiveReason(reasonOption)) continue;
      if (!positivePool.includes(reasonOption)) {
        positivePool.push(reasonOption);
      }
      if (positivePool.length >= MIN_POSITIVE_POOL) break;
    }
  }
  const POSITIVE_REASONS_LIST =
    positivePool.length > 0 ? positivePool : [...POSITIVE_TEMPLATE_REASONS];
  const POSITIVE_REASONS: Set<string> = new Set(POSITIVE_REASONS_LIST);
  const NEGATIVE_REASONS: Set<string> = new Set([...NEGATIVE_TEMPLATE_REASONS]);

  const CAME_BACK_REASONS = [
    TEMPLATE_TX_REASON[8],
    TEMPLATE_TX_REASON[14],
    TEMPLATE_TX_REASON[12],
    TEMPLATE_TX_REASON[13],
  ];

  let finalReason = reason;
  let finalConnector = reasonConnector;
  if (isImprovement) {
    engineState.positiveShuffleBag = engineState.positiveShuffleBag.filter(
      (r) => POSITIVE_REASONS.has(r),
    );
    if (engineState.positiveShuffleBag.length === 0) {
      engineState.positiveShuffleBag = POSITIVE_REASONS_LIST.filter(
        (r) => r !== engineState.lastUsedReason,
      );
      if (engineState.positiveShuffleBag.length === 0)
        engineState.positiveShuffleBag = [...POSITIVE_REASONS_LIST];
    }
    const pickIdx = Math.floor(
      stageRng() * engineState.positiveShuffleBag.length,
    );
    finalReason = engineState.positiveShuffleBag[pickIdx];
    engineState.positiveShuffleBag = [
      ...engineState.positiveShuffleBag.slice(0, pickIdx),
      ...engineState.positiveShuffleBag.slice(pickIdx + 1),
    ];
    stageRng(); // consume: 2nd reason pick (template is single-valued)
    engineState.lastUsedReason = finalReason;
    const improvementConnectors = ["because of", "due to"];
    finalConnector =
      improvementConnectors[
        Math.floor(stageRng() * improvementConnectors.length)
      ] || "because of";
    engineState.improvementCount++;
  } else if (isExacerbate) {
    if (!NEGATIVE_REASONS.has(finalReason))
      finalReason = "did not have good rest";
    if (finalConnector !== "due to" && finalConnector !== "because of")
      finalConnector = "due to";
    stageRng();
    stageRng();
    stageRng();
  } else if (isCameBack) {
    if (engineState.cameBackShuffleBag.length === 0) {
      engineState.cameBackShuffleBag = CAME_BACK_REASONS.filter(
        (r) => r !== engineState.lastUsedReason,
      );
      if (engineState.cameBackShuffleBag.length === 0)
        engineState.cameBackShuffleBag = [...CAME_BACK_REASONS];
    }
    const pickIdx = Math.floor(
      stageRng() * engineState.cameBackShuffleBag.length,
    );
    finalReason = engineState.cameBackShuffleBag[pickIdx];
    engineState.cameBackShuffleBag = [
      ...engineState.cameBackShuffleBag.slice(0, pickIdx),
      ...engineState.cameBackShuffleBag.slice(pickIdx + 1),
    ];
    stageRng();
    engineState.lastUsedReason = finalReason;
    finalConnector = "due to";
    stageRng();
  }

  // --- Associated symptoms (user input priority + rank-rng compat) ---
  const _prevSymptomRank = (() => {
    const s = engineState.prevAssociatedSymptom.toLowerCase();
    if (s.includes("numbness") || s.includes("weakness")) return 4;
    if (s.includes("heaviness")) return 3;
    if (s.includes("stiffness")) return 2;
    if (s.includes("soreness")) return 1;
    return 2;
  })();
  if (acc.progress > 0.5 && _prevSymptomRank > 1) {
    stageRng();
  }
  const associatedSymptoms =
    options.initialState?.associatedSymptoms &&
    options.initialState.associatedSymptoms.length > 0
      ? [...options.initialState.associatedSymptoms]
      : baselineAssociatedSymptoms.length > 0
        ? [...baselineAssociatedSymptoms]
        : [engineState.prevAssociatedSymptom || "soreness"];
  const associatedSymptom = associatedSymptoms[0] || "soreness";
  engineState.prevAssociatedSymptom = associatedSymptom;

  const painFrequency = pickSingle(
    "subjective.painFrequency",
    ruleContext,
    acc.progress,
    stageRng,
    "Frequent (symptoms occur between 51% and 75% of the time)",
  );
  const generalCondition = consts.fixedGeneralCondition;
  const treatmentFocus = pickSingle(
    "assessment.treatmentPrinciples.focusOn",
    ruleContext,
    acc.progress,
    stageRng,
    "focus",
  );

  return {
    ruleContext,
    symptomChange,
    finalReason,
    finalConnector,
    associatedSymptoms,
    associatedSymptom,
    painFrequency,
    treatmentFocus,
    generalCondition,
  };
}
