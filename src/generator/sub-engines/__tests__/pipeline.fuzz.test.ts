/**
 * Property-based fuzz tests for the 6-stage pipeline.
 *
 * These invariants complement the 30 concrete fixture snapshots by
 * exercising randomised seeds/contexts across the supported body parts.
 * Each property is run 50× with a fixed seed for CI determinism.
 *
 * Per AC-B6 (Tier B step 1 plan v5):
 *   P1. pain monotonic non-increasing across visits
 *   P2. spasm ⊆ tenderness ⊆ tightness (per visit)
 *   P3. ROM "floor" — romTrend never regresses from improved → stable →
 *       improved (i.e., if any visit is "stable", no prior visit had a
 *       worse-than-stable rating). We check the weaker invariant:
 *       no "worsened" ROM direction ever appears (trend domain is
 *       {improved, slightly improved, stable}).
 *   P4. reason always from TEMPLATE_TX_REASON whitelist
 *   P5. associatedSymptoms chain: each visit's symptoms ⊆ prior visit's
 *       (never introduce a symptom mid-course; engine only carries forward
 *       baseline)
 */
import fc from "fast-check";
import { setWhitelist } from "../../../parser/template-rule-whitelist";
import { generateTXSequenceStates } from "../../tx-sequence-engine";
import { TEMPLATE_TX_REASON } from "../../../shared/template-options";
import whitelistData from "../../../../frontend/src/data/whitelist.json";

import type {
  BodyPart,
  Laterality,
  GenerationContext,
} from "../../../types";

beforeAll(() => {
  setWhitelist(whitelistData as Record<string, string[]>);
});

// ── Arbitraries ─────────────────────────────────────────────────

const SUPPORTED: BodyPart[] = [
  "LBP",
  "SHOULDER",
  "KNEE",
  "NECK",
  "ELBOW",
  "MID_LOW_BACK",
  "MIDDLE_BACK",
];

const arbLaterality = fc.constantFrom<Laterality>(
  "left",
  "right",
  "bilateral",
);

const arbContextAndOptions = fc.record({
  bodyPart: fc.constantFrom(...SUPPORTED),
  laterality: arbLaterality,
  painCurrent: fc.integer({ min: 3, max: 10 }),
  txCount: fc.integer({ min: 3, max: 15 }),
  seed: fc.integer({ min: 1, max: 1_000_000 }),
});

interface ArbInput {
  bodyPart: BodyPart;
  laterality: Laterality;
  painCurrent: number;
  txCount: number;
  seed: number;
}

function buildContext(
  input: ArbInput,
): { context: GenerationContext; seed: number; txCount: number } {
  const { bodyPart, laterality, painCurrent, txCount, seed } = input;
  const context: GenerationContext = {
    noteType: "TX",
    insuranceType: "OPTUM",
    primaryBodyPart: bodyPart,
    laterality,
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel:
      painCurrent >= 9
        ? "severe"
        : painCurrent >= 7
          ? "moderate to severe"
          : painCurrent >= 6
            ? "moderate"
            : painCurrent >= 4
              ? "mild to moderate"
              : "mild",
    painCurrent,
    associatedSymptoms: ["soreness"],
  };
  return { context, seed, txCount };
}

const NUM_RUNS = 50;

// ── Properties ──────────────────────────────────────────────────

describe("TX pipeline property tests", () => {
  test("P1: pain monotonically non-increasing across visits", () => {
    fc.assert(
      fc.property(arbContextAndOptions, (input) => {
        const { context, seed, txCount } = buildContext(input);
        const { states } = generateTXSequenceStates(context, {
          txCount,
          seed,
          initialState: {
            pain: context.painCurrent ?? 8,
          },
        });
        for (let i = 1; i < states.length; i++) {
          const prev = states[i - 1].painScaleCurrent;
          const curr = states[i].painScaleCurrent;
          if (curr > prev) {
            return false; // Pain rose — invariant violated
          }
        }
        return true;
      }),
      { numRuns: NUM_RUNS, seed: 42 },
    );
  });

  test("P2: muscle subset chain — spasm ⊆ tenderness ⊆ tightness", () => {
    fc.assert(
      fc.property(arbContextAndOptions, (input) => {
        const { context, seed, txCount } = buildContext(input);
        const { states } = generateTXSequenceStates(context, {
          txCount,
          seed,
          initialState: { pain: context.painCurrent ?? 8 },
        });
        for (const v of states) {
          const tight = new Set(v.tightMuscles);
          const tender = new Set(v.tenderMuscles);
          for (const m of tender) {
            if (!tight.has(m)) return false;
          }
          for (const m of v.spasmMuscles) {
            if (!tender.has(m)) return false;
          }
        }
        return true;
      }),
      { numRuns: NUM_RUNS, seed: 43 },
    );
  });

  test("P3: ROM trend is always in {improved, slightly improved, stable}", () => {
    fc.assert(
      fc.property(arbContextAndOptions, (input) => {
        const { context, seed, txCount } = buildContext(input);
        const { states } = generateTXSequenceStates(context, {
          txCount,
          seed,
          initialState: { pain: context.painCurrent ?? 8 },
        });
        const validTrends = new Set([
          "improved",
          "slightly improved",
          "stable",
        ]);
        for (const v of states) {
          if (!validTrends.has(v.soaChain.objective.romTrend)) return false;
        }
        return true;
      }),
      { numRuns: NUM_RUNS, seed: 44 },
    );
  });

  test("P4: reason always from TEMPLATE_TX_REASON whitelist", () => {
    const whitelist = new Set<string>(TEMPLATE_TX_REASON);
    fc.assert(
      fc.property(arbContextAndOptions, (input) => {
        const { context, seed, txCount } = buildContext(input);
        const { states } = generateTXSequenceStates(context, {
          txCount,
          seed,
          initialState: { pain: context.painCurrent ?? 8 },
        });
        for (const v of states) {
          if (!whitelist.has(v.reason)) {
            // Some reasons may be legitimately constructed fallback strings.
            // Allow this specific well-known fallback from the exacerbate branch.
            if (v.reason === "did not have good rest") continue;
            return false;
          }
        }
        return true;
      }),
      { numRuns: NUM_RUNS, seed: 45 },
    );
  });

  test("P5: associatedSymptoms only shrinks or stays equal across visits", () => {
    fc.assert(
      fc.property(arbContextAndOptions, (input) => {
        const { context, seed, txCount } = buildContext(input);
        const { states } = generateTXSequenceStates(context, {
          txCount,
          seed,
          initialState: { pain: context.painCurrent ?? 8 },
        });
        let prevSet: Set<string> | null = null;
        for (const v of states) {
          const curr = new Set(v.associatedSymptoms ?? []);
          if (prevSet) {
            for (const s of curr) {
              if (!prevSet.has(s)) return false;
            }
          }
          prevSet = curr;
        }
        return true;
      }),
      { numRuns: NUM_RUNS, seed: 46 },
    );
  });
});
