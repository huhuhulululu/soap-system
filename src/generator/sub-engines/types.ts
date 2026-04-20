/**
 * Sub-engines pipeline types — FROZEN CONTRACT.
 *
 * Produced in Tier B step 1 Phase B1.1.5 from the state-flow map in
 * .claude-state/tx-engine-state-flow.md (approved by ping 2026-04-19).
 *
 * MODIFICATION POLICY:
 * - Stage implementations in src/generator/sub-engines/stages/*.ts MUST
 *   import these types unchanged.
 * - Any field addition or shape change requires returning to Phase B1.1
 *   to update the state-flow map, then re-deriving this file under a
 *   new user signoff.
 */

import type {
  GenerationContext,
  SeverityLevel,
  BodyPart,
  Laterality,
} from "../../types";
import type {
  NeedleGroups,
  BodyPartKey,
} from "../../shared/template-options";
import type { SelectedMuscles } from "../muscle-selector";
import type { GoalPaths } from "../goal-path-calculator";
import type { PatchedGoals } from "../objective-patch";
import type { TXVisitState } from "../tx-sequence-engine";
import type { SubEngineKind } from "../../shared/sub-seed";

// ─────────────────────────────────────────────────────────────
// Sub-seed runtime wiring (Tier B step 2, W2 — 2026-04-20)
//   Per-stage isolation via `deriveSubSeed(mainSeed, kind, visitIndex)`.
//   Stages 1-4 each consume from their own PRNG stream; stages 5/6
//   do not use RNG. Map StageLabel → SubEngineKind here; the `rom`
//   kind is left unused at runtime but remains in SubEngineKind for
//   the W1 P6 primitive test coverage.
// ─────────────────────────────────────────────────────────────

export type StageLabel = "stage1" | "stage2" | "stage3" | "stage4";

export const STAGE_TO_KIND: Readonly<Record<StageLabel, SubEngineKind>> = {
  stage1: "pain",
  stage2: "symptom",
  stage3: "reason",
  stage4: "muscles",
} as const;

export type StageSeedBag = Readonly<Record<StageLabel, () => number>>;

// ─────────────────────────────────────────────────────────────
// EngineState — cross-visit (session-level) mutable state
//   Sourced from state-flow T1. Every updatable field that the main loop
//   reads across iterations must live here.
// ─────────────────────────────────────────────────────────────

export interface EngineState {
  // Pain progression
  prevPain: number;
  prevPainScaleLabel: string;
  prevPainForSeverity: number;

  // Progress / reason rotation
  prevProgress: number;
  improvementCount: number;
  positiveShuffleBag: string[];
  cameBackShuffleBag: string[];
  lastUsedReason: string;

  // Frequency
  prevFrequency: number;
  prevSymptomDecade: number;

  // Severity / ADL
  prevSeverity: SeverityLevel;
  prevSeverityForAdl: SeverityLevel;
  prevAdlImproved: boolean;
  prevAdlItemCount: number;

  // Muscles numeric (1..5 scales)
  prevTightness: number;
  prevTenderness: number;
  prevSpasm: number;
  prevTightnessBounced: boolean;
  prevTendernessBounced: boolean;
  prevSpasmBounced: boolean;

  // Grading text monotonic tracking (Stage 5 reads to clamp updward moves)
  prevTightnessGrading: string;
  prevTendernessGrade: string; // e.g. "+3"

  // ROM & strength
  prevRomDeficit: number;
  prevStrengthLevel: number;

  // Subjective narrative
  prevAssociatedSymptom: string;

  // V09 needle group inheritance (null before first visit picks)
  fixedNeedleGroups: NeedleGroups | null;

  // Output accumulator — every `visits[-1]` read in reconciliation comes from here
  readonly visits: TXVisitState[];
}

// ─────────────────────────────────────────────────────────────
// EngineConsts — session-fixed values (not mutated in the loop)
//   These are NOT EngineState but each stage needs access.
// ─────────────────────────────────────────────────────────────

export interface EngineConsts {
  rng: () => number;
  actualSeed: number;
  mainSeed: number;

  // Pipeline shape
  txCount: number;
  startIdx: number;

  // Pain targets
  startPain: number;
  ieStartPain: number;
  targetPain: number;

  // Chronic controls
  chronicCapsEnabled: boolean;
  chronicEndRatio: number;
  chronicDampener: number;

  // Progression calibration
  progressMultiplier: number;
  medAdjustments: { spasmBump: number; romDeficitBump: number };

  // Baseline (Stage 2 & 4 read)
  initSeverity: SeverityLevel;
  initialMuscles: SelectedMuscles;
  initialFrequencyIdx: number;
  initialFrequencyLabel: string;
  baselineAssociatedSymptoms: string[];

  // Patient fixed traits
  fixedGeneralCondition: string;
  fixedTonguePulse: { tongue: string; pulse: string };

  // Goal scheduling
  patchedGoals: PatchedGoals;
  goalPaths: GoalPaths;
  freqStart: number;
  txFrequencyGoal: { st: number; lt: number };

  // Context convenience re-export
  context: GenerationContext;
  options: {
    txCount: number;
    seed?: number;
    startVisitIndex?: number;
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
    includeHtml?: boolean;
  };
}

// ─────────────────────────────────────────────────────────────
// VisitAccumulator — per-visit accumulated state
//   Sourced from state-flow T2. Each stage adds its own fields;
//   later stages may overwrite display fields (see T3).
// ─────────────────────────────────────────────────────────────

export interface ObjectiveFactors {
  readonly sessionGapDays: number;
  readonly sleepLoad: number;
  readonly workloadLoad: number;
  readonly weatherExposureLoad: number;
  readonly adherenceLoad: number;
}

export interface SideProgress {
  readonly left: number;
  readonly right: number;
}

export type Trend = "reduced" | "slightly reduced" | "stable";
export type RomStrengthTrend = "improved" | "slightly improved" | "stable";

/** Outputs of Stage 1 `deriveBaseVisitState`. */
export interface BaseVisitFields {
  visitIndex: number;
  progress: number;
  objectiveFactors: ObjectiveFactors;
  painScaleCurrent: number;
  painScaleLabel: string;
  painDelta: number;
  /** next frequency numeric (0..3) */
  nextFrequency: number;
  frequencyImproved: boolean;
}

/** Outputs of Stage 2 `deriveSubjectiveDerived`. */
export interface SubjectiveDerivedFields {
  severityLevel: SeverityLevel;
  prevSeveritySnapshot: SeverityLevel;
  visitMuscles: SelectedMuscles;
  adlItems: string[];
  adlImproved: boolean;
  aggravatingItems: string[];
}

/** Outputs of Stage 3 `buildSubjectiveNarrative`. */
export interface SubjectiveNarrativeFields {
  ruleContext: unknown; // intentionally structural; buildRuleContext output
  symptomChange: string;
  finalReason: string;
  finalConnector: string;
  associatedSymptoms: string[];
  associatedSymptom: string;
  painFrequency: string;
  treatmentFocus: string;
  generalCondition: string;
}

/** Outputs of Stage 4 `buildObjectiveState` (merges original stage 3 numeric + stage 5 text + needle + chainFrequency + visitSymptomScale). */
export interface ObjectiveStateFields {
  // Numeric (true state, pre-cap)
  nextTightness: number;
  nextTenderness: number;
  nextSpasm: number;
  tightnessBounced: boolean;
  tendernessBounced: boolean;
  spasmBounced: boolean;
  nextRomDeficit: number;
  nextStrengthLevel: number;
  strengthGrade: string;

  // Trends (pre-reconcile; Stage 6 may recompute finalTightnessTrend etc.)
  tightnessTrend: Trend;
  tendernessTrend: Trend;
  spasmTrend: Trend;
  romTrend: RomStrengthTrend;
  strengthTrend: RomStrengthTrend;

  // Text grading (true — Stage 5 cap may overwrite these on the display copy)
  tightnessGrading: string;
  tendernessGrading: string;
  spasmGrading: string;

  // Side progress (bilateral only)
  sideProgress?: SideProgress;

  // Needle (V09: may set EngineState.fixedNeedleGroups on first visit)
  needlePoints: NeedleGroups;

  // Frequency text (true — Stage 5 cap may defer back to prev)
  chainFrequency: string;

  // Symptom scale (true — Stage 5 cap may defer back to prev)
  visitSymptomScale: string;

  // Cumulative metrics
  cumulativePainDrop: number;
  adlDelta: number;
}

/** Display copies — Stage 5 `applyDisplayCaps` may revert each back to `visits[-1].*`.
 *  Strength is intentionally absent (cannot defer — ladder index).
 */
export interface VisitDisplay {
  tightnessGrading: string;
  tendernessGrading: string;
  spasmGrading: string;
  chainFrequency: string;
  visitSymptomScale: string;
}

/** Outputs of Stage 6 `buildFinalAssessment`. */
export interface FinalAssessmentFields {
  finalTightnessTrend: Trend;
  finalTendernessTrend: Trend;
  finalSpasmTrend: Trend;
  finalFrequencyImproved: boolean;
  finalSymptomScaleChanged: boolean;
  finalDimScore: { score: number; changedDims: string[] };
  hasFinalObjectiveChange: boolean;
  hasSubjectiveImprovementSignal: boolean;
  assessmentFromChain: TXVisitState["soaChain"]["assessment"];
  /** symptomChange final S-O guard may overwrite narrative field */
  finalSymptomChange: string;
  /** SoaChain serialised onto TXVisitState */
  soaChain: TXVisitState["soaChain"];
}

/** Single-visit accumulator. Stages populate in order; later stages may
 *  rewrite display copy (see T3) but must not touch pre-display canonicals. */
export interface VisitAccumulator
  extends BaseVisitFields,
    SubjectiveDerivedFields,
    SubjectiveNarrativeFields,
    ObjectiveStateFields,
    FinalAssessmentFields {
  /** Stage 5 output — display copies (post-cap) */
  display: VisitDisplay;
}

// ─────────────────────────────────────────────────────────────
// Stage signatures — each stage is a pure function over inputs.
//   Each receives the (readonly) EngineConsts + (mutable read view of)
//   EngineState + partial VisitAccumulator; returns a partial
//   VisitAccumulator to merge.
// ─────────────────────────────────────────────────────────────

export interface StageContext {
  readonly consts: EngineConsts;
  readonly engineState: EngineState;
  readonly visitIndex: number;
  readonly acc: Partial<VisitAccumulator>;
}

export type StageResult<K extends keyof VisitAccumulator> = Pick<
  VisitAccumulator,
  K
>;

/** Stage 1: baseVisitState
 *  Inputs: visit-index-sensitive consts + EngineState (prev pain/progress/freq)
 *  Side effects: MUTATES engineState.prevProgress, prevPain
 */
export type Stage1BaseVisitState = (
  ctx: StageContext,
) => StageResult<keyof BaseVisitFields>;

/** Stage 2: subjectiveDerived (severity / ADL / muscle counts)
 *  Side effects: MUTATES engineState.prevSeverity, prevPainForSeverity,
 *                prevAdlImproved, prevAdlItemCount, prevSeverityForAdl.
 */
export type Stage2SubjectiveDerived = (
  ctx: StageContext,
) => StageResult<keyof SubjectiveDerivedFields>;

/** Stage 3: subjectiveNarrative (symptomChange + reason chain)
 *  Depends on dim score from Stage 1+2 + pending (pre-cap) Stage 4 values.
 *  Side effects: MUTATES engineState.positiveShuffleBag, cameBackShuffleBag,
 *                lastUsedReason, improvementCount, prevAssociatedSymptom.
 */
export type Stage3SubjectiveNarrative = (
  ctx: StageContext,
) => StageResult<keyof SubjectiveNarrativeFields>;

/** Stage 4: objectiveState (numeric + grading text + needle + chainFrequency + visitSymptomScale)
 *  Side effects: MUTATES engineState.prevTightness/Tenderness/Spasm/RomDeficit/StrengthLevel,
 *                prevTightnessBounced/Tendernessbounced/Spasmbounced,
 *                prevTightnessGrading, prevTendernessGrade, prevPainScaleLabel,
 *                prevSymptomDecade, fixedNeedleGroups (first visit only).
 */
export type Stage4ObjectiveState = (
  ctx: StageContext,
) => StageResult<keyof ObjectiveStateFields>;

/** Stage 5: applyDisplayCaps
 *  Pure over inputs + visits[-1] (no RNG, no EngineState mutation except read).
 *  Returns the `display` sub-object.
 */
export type Stage5ApplyDisplayCaps = (
  ctx: StageContext,
) => StageResult<"display">;

/** Stage 6: buildFinalAssessment
 *  Reads display copies + trends; recomputes finalDimScore and assessment.
 *  Pure. No RNG. No EngineState mutation.
 */
export type Stage6BuildFinalAssessment = (
  ctx: StageContext,
) => StageResult<keyof FinalAssessmentFields>;

// ─────────────────────────────────────────────────────────────
// Engine init — produces initial EngineState + EngineConsts before main loop.
// ─────────────────────────────────────────────────────────────

export interface EngineInitOutput {
  consts: EngineConsts;
  engineState: EngineState;
}

export type EngineInit = (args: {
  context: GenerationContext;
  options: EngineConsts["options"];
}) => EngineInitOutput;

// ─────────────────────────────────────────────────────────────
// Full pipeline — ordering contract.
// ─────────────────────────────────────────────────────────────

/** Per-visit stage ordering. Implementations must compose in this exact
 *  order so EngineState mutations stay consistent with the original
 *  generateTXSequenceStates behaviour. */
export const STAGE_ORDER = [
  "stage1_baseVisitState",
  "stage2_subjectiveDerived",
  "stage3_subjectiveNarrative",
  "stage4_objectiveState",
  "stage5_applyDisplayCaps",
  "stage6_buildFinalAssessment",
] as const;

export type StageName = (typeof STAGE_ORDER)[number];

// ─────────────────────────────────────────────────────────────
// Re-export for consumers
// ─────────────────────────────────────────────────────────────

export type {
  GenerationContext,
  SeverityLevel,
  BodyPart,
  Laterality,
  NeedleGroups,
  BodyPartKey,
  SelectedMuscles,
  GoalPaths,
  PatchedGoals,
  TXVisitState,
};
