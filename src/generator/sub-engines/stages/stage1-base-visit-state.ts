/**
 * Stage 1: baseVisitState
 *
 * Compute per-visit progress, objectiveFactors, and pain.
 *
 * RNG consumed (in order):
 *   1. progressNoise
 *   2–6. objectiveFactors (sessionGapDays / sleepLoad / workloadLoad /
 *                          weatherExposureLoad / adherenceLoad)
 *   7. _painRng (preserved, result discarded — maintains main PRNG stream)
 *
 * Does NOT compute frequency (that shifts further into Stage 2 to match
 * original RNG order: _adlRng1/2 must fire before _freqRng).
 *
 * Moved from src/generator/tx-sequence-engine.ts:1162-1221 during B1.4.
 * Mutates engineState.prevProgress, prevPain, prevPainScaleLabel.
 */

import type {
  EngineConsts,
  EngineState,
  BaseVisitFields,
} from "../types";
import { clamp, snapPainToGrid } from "../shared-helpers";

export function deriveBaseVisitState(args: {
  engineState: EngineState;
  consts: EngineConsts;
  visitIndex: number;
}): Omit<BaseVisitFields, "nextFrequency" | "frequencyImproved"> {
  const { engineState, consts, visitIndex: i } = args;
  const { rng, txCount, goalPaths, progressMultiplier, startPain } = consts;

  // progress (S-curve)
  const progressLinear = i / txCount;
  const acc = Math.sqrt(progressLinear);
  const progressBase = 3 * acc * acc - 2 * acc * acc * acc;
  const progressNoise = (rng() - 0.5) * 0.08;
  const rawProgress = clamp(
    progressBase * progressMultiplier + progressNoise,
    0.05,
    1.0,
  );
  const progress = Math.max(engineState.prevProgress, rawProgress);
  engineState.prevProgress = progress;

  // objectiveFactors
  const objectiveFactors = {
    sessionGapDays: Math.max(1, Math.round(1 + rng() * 7)),
    sleepLoad: Number((rng() * 1.0).toFixed(2)),
    workloadLoad: Number((rng() * 1.0).toFixed(2)),
    weatherExposureLoad: Number((rng() * 1.0).toFixed(2)),
    adherenceLoad: Number((rng() * 1.0).toFixed(2)),
  };

  const disruption =
    objectiveFactors.sleepLoad * 0.12 +
    objectiveFactors.workloadLoad * 0.1 +
    objectiveFactors.weatherExposureLoad * 0.1 +
    objectiveFactors.adherenceLoad * 0.12 +
    clamp((objectiveFactors.sessionGapDays - 3) / 10, 0, 0.4);

  // Preserve rng() call for PRNG sequence compatibility (was painNoise)
  const _painRng = (rng() - 0.5) * 0.2 + disruption * 0.08;
  void _painRng;

  // Pain: discrete scheduling from goal-path-calculator
  const painIsScheduledDrop = goalPaths.pain.changeVisits.includes(i);
  const painDropAmount = painIsScheduledDrop ? 0.6 + progress * 0.3 : 0;
  let painScaleCurrent = clamp(
    engineState.prevPain - painDropAmount,
    goalPaths.pain.ltGoal,
    startPain,
  );
  painScaleCurrent = Math.min(engineState.prevPain, painScaleCurrent);
  const snapped = snapPainToGrid(painScaleCurrent);
  let painScaleLabel = snapped.label;

  // Half-step snap between scheduled drops
  if (
    !painIsScheduledDrop &&
    engineState.prevPain - Math.floor(engineState.prevPain) > 0.3
  ) {
    const intPain = Math.floor(engineState.prevPain);
    if (intPain >= goalPaths.pain.ltGoal) {
      painScaleCurrent = intPain;
      painScaleLabel = snapPainToGrid(painScaleCurrent).label;
    }
  }

  const painDelta = engineState.prevPain - painScaleCurrent;
  engineState.prevPain = painScaleCurrent;
  // NOTE: prevPainScaleLabel is updated in Stage 4 (after ROM/trend reconciliation)

  return {
    visitIndex: i,
    progress,
    objectiveFactors,
    painScaleCurrent,
    painScaleLabel,
    painDelta,
  };
}
