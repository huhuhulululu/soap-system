/**
 * Engine initialization: compute EngineConsts + initial EngineState
 * before the per-visit main loop.
 *
 * Moved from src/generator/tx-sequence-engine.ts lines 834-1160 during
 * Tier B step 1 Phase B1.4. Pure extraction — RNG sequence must stay
 * byte-identical to the original, so snapshot diffs remain zero.
 */

import type { GenerationContext, SeverityLevel } from "../../types";
import {
  inferCondition,
  inferProgressMultiplier,
  inferInitialAdjustments,
} from "../../knowledge/medical-history-engine";
import { computeGoalPaths } from "../goal-path-calculator";
import { computePatchedGoals } from "../objective-patch";
import {
  STRENGTH_LADDER,
  strengthToIndex,
  strengthFromPain,
} from "../../shared/strength-table";
import { createSeededRng } from "../../shared/seeded-rng";
import { objectiveMuscleSeed } from "../../shared/muscle-seed";
import {
  TEMPLATE_MUSCLES,
  TEMPLATE_ADL,
  TEMPLATE_TONE_MAP,
  type BodyPartKey,
} from "../../shared/template-options";
import {
  selectInitialMuscles,
  reduceMuscles,
} from "../muscle-selector";
import { getADLWeightsByMuscles } from "../../shared/muscle-adl-affinity";
import {
  clamp,
  painGoalToInt,
  symptomGoalToDecade,
  adlGoalToNum,
  severityToAdlLevel,
  symptomScaleToDecade,
  frequencyToNum,
  parsePainTarget,
  severityToCount,
  snapPainToGrid,
  severityFromPain,
  findTemplateOption,
} from "./shared-helpers";
import type { EngineConsts, EngineState } from "./types";

export interface EngineInitArgs {
  context: GenerationContext;
  options: EngineConsts["options"];
}

export interface EngineInitResult {
  consts: EngineConsts;
  engineState: EngineState;
}

export function initEngine(args: EngineInitArgs): EngineInitResult {
  const { context, options } = args;
  const txCount = Math.max(1, options.txCount);
  const startIdx = options.startVisitIndex || 1;
  const { rng, seed: actualSeed } = createSeededRng(options.seed);

  const ieStartPain =
    context.previousIE?.subjective?.painScale?.current ??
    context.painCurrent ??
    8;
  const startPain = options.initialState?.pain ?? ieStartPain;
  const stFallback =
    ieStartPain <= 3
      ? 1
      : ieStartPain <= 6
        ? 2
        : Math.ceil(
            ieStartPain -
              (ieStartPain - Math.max(2, ieStartPain * 0.25)) *
                (1 - (1 - 0.55) * (1 - 0.55)),
          );
  const chronicCapsEnabled =
    context.chronicityLevel === "Chronic" && !context.disableChronicCaps;
  const chronicEndRatio = chronicCapsEnabled ? 0.55 : 0.25;
  const ltFallback =
    ieStartPain <= 6
      ? 1
      : Math.ceil(Math.max(2, ieStartPain * chronicEndRatio));
  const shortTermTarget = parsePainTarget(
    context.previousIE?.plan?.shortTermGoal?.painScaleTarget,
    stFallback,
  );
  const longTermTarget = parsePainTarget(
    context.previousIE?.plan?.longTermGoal?.painScaleTarget,
    ltFallback,
  );
  const targetPain =
    startPain - shortTermTarget < 1.5 ? longTermTarget : shortTermTarget;

  const medHistory = context.medicalHistory || [];
  const baseMultiplier = inferProgressMultiplier(medHistory, context.age);
  const chronicDampener = chronicCapsEnabled ? 0.72 : 1.0;
  const progressMultiplier = baseMultiplier * chronicDampener;
  const medAdjustments = inferInitialAdjustments(
    medHistory,
    context.primaryBodyPart,
  );

  const initialFrequencyIdx = clamp(
    options.initialState?.frequency ??
      frequencyToNum(context.painFrequency || ""),
    0,
    3,
  );
  const initialFrequencyLabel = findTemplateOption(
    "subjective.painFrequency",
    [
      context.painFrequency || "",
      [
        "Intermittent (symptoms occur less than 25% of the time)",
        "Occasional (symptoms occur between 26% and 50% of the time)",
        "Frequent (symptoms occur between 51% and 75% of the time)",
        "Constant (symptoms occur between 76% and 100% of the time)",
      ][initialFrequencyIdx],
    ],
    context.painFrequency ||
      "Constant (symptoms occur between 76% and 100% of the time)",
  );

  const initSeverity = severityFromPain(startPain);
  const hasMuscleTemplate = context.primaryBodyPart in TEMPLATE_MUSCLES;
  const initialMuscles = hasMuscleTemplate
    ? selectInitialMuscles(
        context.primaryBodyPart,
        initSeverity,
        objectiveMuscleSeed(context),
      )
    : {
        tightness: [] as string[],
        tenderness: [] as string[],
        spasm: [] as string[],
      };
  const severityToInit: Record<string, number> = {
    severe: 4,
    "moderate to severe": 3.5,
    moderate: 3,
    "mild to moderate": 2,
    mild: 1,
  };
  const initObjLevel = severityToInit[initSeverity] ?? 3;
  const prevTightness =
    options.initialState?.tightness ?? Math.round(initObjLevel);
  const prevTenderness =
    options.initialState?.tenderness ?? Math.floor(initObjLevel);
  const prevSpasm = Math.min(
    3,
    (options.initialState?.spasm ?? Math.min(3, Math.round(initObjLevel))) +
      medAdjustments.spasmBump,
  );
  const prevRomDeficit = Math.min(0.7, 0.42 + medAdjustments.romDeficitBump);

  const prevSeverityInit: SeverityLevel = severityFromPain(
    options.initialState?.pain ?? startPain,
  );
  const ieAdlItemCount = (() => {
    const bp = context.primaryBodyPart as BodyPartKey;
    const validADL = new Set(TEMPLATE_ADL[bp] ?? []);
    const ieMuscles = reduceMuscles(initialMuscles, prevSeverityInit);
    const ieAdlWeights = getADLWeightsByMuscles(
      ieMuscles.tightness as string[],
      context.primaryBodyPart,
    );
    const count = severityToCount(prevSeverityInit, "adl");
    return ieAdlWeights
      .filter((w) => validADL.has(w.adl))
      .slice(0, count).length;
  })();

  const baselineAssociatedSymptoms = (() => {
    if (
      options.initialState?.associatedSymptoms &&
      options.initialState.associatedSymptoms.length > 0
    ) {
      return [...options.initialState.associatedSymptoms];
    }
    if (options.initialState?.associatedSymptom) {
      return [options.initialState.associatedSymptom];
    }
    if (context.associatedSymptoms && context.associatedSymptoms.length > 0) {
      return [...context.associatedSymptoms];
    }
    if (context.associatedSymptom) {
      return [context.associatedSymptom];
    }
    return ["soreness"];
  })();

  const fixedGeneralCondition: string = (() => {
    if (options.initialState?.generalCondition)
      return options.initialState.generalCondition;
    if (context.baselineCondition) return context.baselineCondition;
    return inferCondition(
      context.medicalHistory || [],
      context.age,
      context.systemicPattern,
    );
  })();

  const PATTERN_TONGUE_DEFAULTS: Record<
    string,
    { tongue: string; pulse: string }
  > = Object.fromEntries(
    Object.entries(TEMPLATE_TONE_MAP).map(([k, v]) => [
      k,
      { tongue: v.tongueDefault, pulse: v.pulseDefault },
    ]),
  );
  const fixedTonguePulse: { tongue: string; pulse: string } = (() => {
    const ieTonguePulse = context.previousIE?.objective?.tonguePulse;
    if (ieTonguePulse?.tongue && ieTonguePulse?.pulse) {
      return {
        tongue: ieTonguePulse.tongue,
        pulse: ieTonguePulse.pulse,
      };
    }
    const patternDefault =
      PATTERN_TONGUE_DEFAULTS[context.localPattern || ""] ||
      PATTERN_TONGUE_DEFAULTS[context.systemicPattern || ""];
    if (patternDefault) return patternDefault;
    return {
      tongue: "Pink with thin white coating",
      pulse: "Even and moderate",
    };
  })();

  // Goal scheduling
  const TIGHTNESS_TO_NUM: Record<string, number> = {
    mild: 1,
    "mild to moderate": 2,
    moderate: 3,
    "moderate to severe": 4,
    severe: 5,
  };
  const symptomTypeForGoals =
    options.initialState?.associatedSymptoms?.[0] ??
    options.initialState?.associatedSymptom ??
    context.associatedSymptoms?.[0] ??
    context.associatedSymptom ??
    "soreness";
  const patchedGoals = computePatchedGoals(
    startPain,
    initSeverity,
    context.primaryBodyPart || "LBP",
    symptomTypeForGoals,
    {
      medicalHistory: medHistory,
      age: context.age,
    },
  );
  const freqStart =
    options.initialState?.frequency ??
    frequencyToNum(context.painFrequency || "");
  const txFrequencyGoal = {
    st: Math.max(0, freqStart - 1),
    lt: Math.max(0, freqStart - 2),
  } as const;
  const goalPaths = computeGoalPaths(
    {
      tightness: {
        start: prevTightness,
        st: TIGHTNESS_TO_NUM[patchedGoals.tightness.st] ?? 3,
        lt: TIGHTNESS_TO_NUM[patchedGoals.tightness.lt] ?? 2,
      },
      tenderness: {
        start: prevTenderness,
        st: patchedGoals.tenderness.st,
        lt: patchedGoals.tenderness.lt,
      },
      spasm: {
        start: prevSpasm,
        st: patchedGoals.spasm.st,
        lt: patchedGoals.spasm.lt,
      },
      strength: {
        start:
          strengthToIndex(strengthFromPain(startPain)) +
          (context.chronicityLevel === "Chronic" ||
          context.baselineCondition === "poor"
            ? -1
            : 0),
        st: strengthToIndex(patchedGoals.strength.st),
        lt: strengthToIndex(patchedGoals.strength.lt),
      },
      pain: {
        start: Math.round(startPain),
        st: painGoalToInt(patchedGoals.pain.st),
        lt: painGoalToInt(patchedGoals.pain.lt),
      },
      frequency: {
        start: freqStart,
        st: txFrequencyGoal.st,
        lt: txFrequencyGoal.lt,
      },
      symptomScale: {
        start: symptomScaleToDecade(
          options.initialState?.symptomScale || "70%",
        ),
        st: symptomGoalToDecade(patchedGoals.symptomPct.st),
        lt: symptomGoalToDecade(patchedGoals.symptomPct.lt),
      },
      adlA: {
        start: severityToAdlLevel(initSeverity),
        st: adlGoalToNum(patchedGoals.adl.st),
        lt: adlGoalToNum(patchedGoals.adl.lt),
      },
      adlB: {
        start:
          context.primaryBodyPart === "LBP"
            ? 0
            : severityToAdlLevel(initSeverity),
        st:
          context.primaryBodyPart === "LBP"
            ? 0
            : adlGoalToNum(patchedGoals.adl.st),
        lt:
          context.primaryBodyPart === "LBP"
            ? 0
            : adlGoalToNum(patchedGoals.adl.lt),
      },
    },
    txCount,
    rng,
    {
      painEarlyGuard: Math.ceil(txCount * (chronicCapsEnabled ? 0.3 : 0.2)),
      symptomScaleEarlyGuard: Math.ceil(txCount * 0.2),
    },
  );

  // Voids preserved to match original rng sequence (unchanged — no rng here)
  void STRENGTH_LADDER;

  // Initial EngineState — mirrors original let-bindings in main loop head
  const engineState: EngineState = {
    prevPain: startPain,
    prevPainScaleLabel: snapPainToGrid(startPain).label,
    prevPainForSeverity: startPain,
    prevProgress: startIdx > 1 ? (startIdx - 1) / txCount : 0,
    improvementCount: 0,
    positiveShuffleBag: [],
    cameBackShuffleBag: [],
    lastUsedReason: "",
    prevFrequency: options.initialState?.frequency ?? 3,
    prevSymptomDecade: symptomScaleToDecade(
      options.initialState?.symptomScale || "70%",
    ),
    prevSeverity: prevSeverityInit,
    prevSeverityForAdl: prevSeverityInit,
    prevAdlImproved: false,
    prevAdlItemCount: ieAdlItemCount,
    prevTightness,
    prevTenderness,
    prevSpasm,
    prevTightnessBounced: false,
    prevTendernessBounced: false,
    prevSpasmBounced: false,
    prevTightnessGrading: options.initialState?.tightnessGrading ?? "",
    prevTendernessGrade: options.initialState?.tendernessGrade ?? "",
    prevRomDeficit,
    prevStrengthLevel: 0, // filled below after strength computation
    prevAssociatedSymptom: baselineAssociatedSymptoms[0] ?? "soreness",
    fixedNeedleGroups: options.initialState?.needleGroups ?? null,
    visits: [],
  };

  // prevStrengthLevel from goal path (post-goalPaths, matches original line 1160)
  engineState.prevStrengthLevel = Math.max(0, goalPaths.strength.startValue);

  const consts: EngineConsts = {
    rng,
    actualSeed,
    mainSeed: actualSeed,
    txCount,
    startIdx,
    startPain,
    ieStartPain,
    targetPain,
    chronicCapsEnabled,
    chronicEndRatio,
    chronicDampener,
    progressMultiplier,
    medAdjustments,
    initSeverity,
    initialMuscles,
    initialFrequencyIdx,
    initialFrequencyLabel,
    baselineAssociatedSymptoms,
    fixedGeneralCondition,
    fixedTonguePulse,
    patchedGoals,
    goalPaths,
    freqStart,
    txFrequencyGoal,
    context,
    options,
  };

  return { consts, engineState };
}
