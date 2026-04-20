/**
 * TX Sequence Engine — orchestrator.
 *
 * Since Tier B step 1 Phase B1.4 (2026-04-19), the main loop body is composed
 * from 6 stage modules under `src/generator/sub-engines/stages/`. This file
 * coordinates them while preserving the original main-PRNG call sequence, so
 * fixture snapshots stay byte-identical.
 *
 * Stage call order (matches original interleaving):
 *   Stage 1 deriveBaseVisitState            (pain + objectiveFactors + progress)
 *   Stage 2 deriveSubjectiveDerived         (severity + ADL + frequency)
 *   Stage 4a deriveObjectiveNumeric          (tight/tender/spasm numeric +
 *                                            ROM/strength + plateau + side)
 *   Stage 3 buildSubjectiveNarrative        (symptomChange + reason + etc.)
 *   Stage 4b buildObjectiveGrading           (grading text + needle +
 *                                            chainFrequency + visitSymptomScale)
 *   Stage 5 applyDisplayCaps                (output-layer cap reconciliation)
 *   Stage 6 buildFinalAssessment            (final trends + assessment chain)
 */

import type { GenerationContext, SeverityLevel } from "../types";
import type { NeedleGroups } from "../shared/template-options";
import { createSeededRng } from "../shared/seeded-rng";
import { deriveSubSeed } from "../shared/sub-seed";
import { initEngine } from "./sub-engines/engine-init";
import { STAGE_TO_KIND, type StageSeedBag } from "./sub-engines/types";
import { deriveBaseVisitState } from "./sub-engines/stages/stage1-base-visit-state";
import { deriveSubjectiveDerived } from "./sub-engines/stages/stage2-subjective-derived";
import {
  deriveObjectiveNumeric,
  buildObjectiveGrading,
} from "./sub-engines/stages/stage4-objective-state";
import { buildSubjectiveNarrative } from "./sub-engines/stages/stage3-subjective-narrative";
import { applyDisplayCaps } from "./sub-engines/stages/stage5-apply-display-caps";
import { buildFinalAssessment } from "./sub-engines/stages/stage6-build-final-assessment";

// Re-export utilities previously defined here, so external callers
// (tests, scripts) keep working without path churn.
export {
  snapPainToGrid,
  snapSymptomToGrid,
  deriveAssessmentFromSOA,
  computeDimensionScore,
} from "./sub-engines/shared-helpers";

// ─── Public types ─────────────────────────────────────────────────

export interface TXSequenceOptions {
  txCount: number;
  seed?: number;
  /** 是否同时生成 HTML（默认 false，可显著减少批量仅文本场景开销） */
  includeHtml?: boolean;
  /** 从第几个 TX 开始生成（1-based）。省略时从 1 开始。 */
  startVisitIndex?: number;
  /** 从用户最后一个 TX 提取的实际状态，作为续写起点。 */
  initialState?: {
    pain: number;
    tightness?: number;
    tenderness?: number;
    spasm?: number;
    frequency?: number;
    painTypes?: string[];
    associatedSymptoms?: string[];
    associatedSymptom?: string;
    symptomScale?: string;
    generalCondition?: string;
    inspection?: string;
    tightnessGrading?: string;
    tendernessGrade?: string;
    tonguePulse?: { tongue: string; pulse: string };
    acupoints?: string[];
    needleGroups?: NeedleGroups;
    electricalStimulation?: boolean;
    treatmentTime?: number;
  };
}

export interface TXVisitState {
  visitIndex: number;
  progress: number;
  painScaleCurrent: number;
  painScaleLabel: string;
  severityLevel: SeverityLevel;
  symptomChange: string;
  reasonConnector: string;
  reason: string;
  associatedSymptoms?: readonly string[];
  associatedSymptom: string;
  painFrequency: string;
  generalCondition: string;
  treatmentFocus: string;
  tightnessGrading: string;
  tendernessGrading: string;
  spasmGrading: string;
  tightMuscles: readonly string[];
  tenderMuscles: readonly string[];
  spasmMuscles: readonly string[];
  adlItems: readonly string[];
  aggravatingItems: readonly string[];
  /** Engine-scheduled strength grade (overrides objective-patch bumpStrength) */
  strengthGrade?: string;
  needlePoints: NeedleGroups;
  tonguePulse: {
    tongue: string;
    pulse: string;
  };
  /** 续写继承字段 */
  painTypes?: string[];
  inspection?: string;
  symptomScale?: string;
  electricalStimulation?: boolean;
  treatmentTime?: number;
  sideProgress?: {
    left: number;
    right: number;
  };
  objectiveFactors: {
    sessionGapDays: number;
    sleepLoad: number;
    workloadLoad: number;
    weatherExposureLoad: number;
    adherenceLoad: number;
  };
  soaChain: {
    subjective: {
      painChange: "improved" | "similar" | "worsened";
      adlChange: "improved" | "stable";
      frequencyChange: "improved" | "stable";
    };
    objective: {
      tightnessTrend: "reduced" | "slightly reduced" | "stable";
      tendernessTrend: "reduced" | "slightly reduced" | "stable";
      spasmTrend: "reduced" | "slightly reduced" | "stable";
      romTrend: "improved" | "slightly improved" | "stable";
      strengthTrend: "improved" | "slightly improved" | "stable";
    };
    assessment: {
      present: string;
      patientChange: string;
      whatChanged: string;
      physicalChange: string;
      findingType: string;
      tolerated: string;
      response: string;
      adverseEffect: string;
    };
  };
  /** Per-movement ROM degree floors (populated by renderer) */
  romFloors?: Record<string, number>;
}

export interface TXSequenceResult {
  states: TXVisitState[];
  /** 用于复现的 seed，传回 options.seed 即可得到相同结果 */
  seed: number;
}

// ─── Orchestrator ─────────────────────────────────────────────────

export function generateTXSequenceStates(
  context: GenerationContext,
  options: TXSequenceOptions,
): TXSequenceResult {
  const { consts, engineState } = initEngine({ context, options });

  for (let i = consts.startIdx; i <= consts.txCount; i++) {
    // Per-visit stage seed bag: each stage draws from its own PRNG stream
    // derived from the main seed. See ADR D42 / ARCHITECTURE.md "Sub-seed
    // runtime wiring" section for scope + known limitations.
    const stageSeeds: StageSeedBag = {
      stage1: createSeededRng(
        deriveSubSeed(consts.mainSeed, STAGE_TO_KIND.stage1, i),
      ).rng,
      stage2: createSeededRng(
        deriveSubSeed(consts.mainSeed, STAGE_TO_KIND.stage2, i),
      ).rng,
      stage3: createSeededRng(
        deriveSubSeed(consts.mainSeed, STAGE_TO_KIND.stage3, i),
      ).rng,
      stage4: createSeededRng(
        deriveSubSeed(consts.mainSeed, STAGE_TO_KIND.stage4, i),
      ).rng,
    };

    // --- Stage 1 ---
    const s1 = deriveBaseVisitState({
      engineState,
      consts,
      visitIndex: i,
      stageRng: stageSeeds.stage1,
    });

    // --- Stage 2 (severity + ADL + frequency) ---
    const s2 = deriveSubjectiveDerived({
      acc: s1,
      engineState,
      consts,
      stageRng: stageSeeds.stage2,
    });

    // --- Stage 4a (objective numeric) ---
    const s4a = deriveObjectiveNumeric({
      acc: { ...s1, ...s2 },
      engineState,
      consts,
      stageRng: stageSeeds.stage4,
    });

    // --- Stage 3 (subjective narrative) ---
    const s3 = buildSubjectiveNarrative({
      acc: { ...s1, ...s2, ...s4a },
      engineState,
      consts,
      stageRng: stageSeeds.stage3,
    });

    // --- Stage 4b (grading text + needle + chainFrequency + visitSymptomScale) ---
    const s4b = buildObjectiveGrading({
      acc: { ...s1, ...s2, ...s4a, ...s3 },
      engineState,
      consts,
      stageRng: stageSeeds.stage4,
    });

    // Merge partial accumulator for Stage 5 / Stage 6
    const acc = {
      ...s1,
      ...s2,
      ...s4a,
      ...s3,
      ...s4b,
      display: {
        tightnessGrading: s4b.tightnessGrading,
        tendernessGrading: s4b.tendernessGrading,
        spasmGrading: s4b.spasmGrading,
        chainFrequency: s4b.chainFrequency,
        visitSymptomScale: s4b.visitSymptomScale,
      },
    };

    // --- Stage 5 (apply display caps) ---
    const s5 = applyDisplayCaps({ acc, engineState });
    acc.display = s5.display;

    // --- Stage 6 (final assessment) ---
    const s6 = buildFinalAssessment({ acc, engineState, consts });

    // Push to visits[] (consumer-facing TXVisitState)
    const visit: TXVisitState = {
      visitIndex: i,
      progress: acc.progress,
      painScaleCurrent: acc.painScaleCurrent,
      painScaleLabel: acc.painScaleLabel,
      severityLevel: acc.severityLevel,
      symptomChange: s6.finalSymptomChange,
      reasonConnector: acc.finalConnector,
      reason: acc.finalReason,
      associatedSymptoms: acc.associatedSymptoms,
      associatedSymptom: acc.associatedSymptom,
      painFrequency: acc.display.chainFrequency,
      generalCondition: acc.generalCondition,
      treatmentFocus: acc.treatmentFocus,
      tightnessGrading: acc.display.tightnessGrading,
      tendernessGrading: acc.display.tendernessGrading,
      spasmGrading: acc.display.spasmGrading,
      tightMuscles: acc.visitMuscles.tightness,
      tenderMuscles: acc.visitMuscles.tenderness,
      spasmMuscles: acc.visitMuscles.spasm,
      adlItems: acc.adlItems,
      aggravatingItems: acc.aggravatingItems,
      strengthGrade: acc.strengthGrade,
      needlePoints: acc.needlePoints,
      tonguePulse: consts.fixedTonguePulse,
      painTypes: options.initialState?.painTypes,
      inspection: options.initialState?.inspection,
      symptomScale: acc.display.visitSymptomScale,
      electricalStimulation: options.initialState?.electricalStimulation,
      treatmentTime: options.initialState?.treatmentTime,
      sideProgress: acc.sideProgress,
      objectiveFactors: acc.objectiveFactors,
      soaChain: s6.soaChain,
    };
    engineState.visits.push(visit);
  }

  return { states: engineState.visits, seed: consts.actualSeed };
}
