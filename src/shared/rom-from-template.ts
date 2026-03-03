/**
 * ROM value picker from TEMPLATE_ROM discrete options.
 *
 * Instead of computing ROM via formula (normalDegrees × limitFactor × diffFactor),
 * we pick directly from the MDLand template dropdown values filtered by severity.
 */

import {
  type BodyPartKey,
  type Severity,
  TEMPLATE_ROM,
} from "./template-options";

export type RomTrend = "improved" | "slightly improved" | "stable";

export interface TemplateRomPainPickHints {
  progress?: number;
  trend?: RomTrend;
  /** Floor: picked degrees must be >= this value (monotonicity guard) */
  minDegrees?: number;
}

/** Body parts that have TEMPLATE_ROM data */
const TEMPLATE_ROM_KEYS = new Set<string>([
  "LBP",
  "NECK",
  "SHOULDER",
  "KNEE",
  "ELBOW",
  "HIP",
  "THIGH",
]);

export function hasTemplateROM(bp: string): bp is BodyPartKey {
  return TEMPLATE_ROM_KEYS.has(bp);
}

/**
 * Map BODY_PART_ROM movement names → TEMPLATE_ROM movement names.
 * Only entries that differ need to be listed.
 */
const MOVEMENT_NAME_MAP: Record<string, Record<string, string>> = {
  NECK: {
    "Extension (look up)": "Extension",
    "Flexion (look down)": "Flexion",
    "Rotation to Right (look to right)": "Rotation to Right",
    "Rotation to Left (look to left)": "Rotation to Left",
    "Flexion to the Right (bending right)": "Lateral Flexion to the Right",
    "Flexion to the Left (bending left)": "Lateral Flexion to the Left",
  },
  SHOULDER: {
    "External Rotation": "External rotation",
    "Internal Rotation": "Internal rotation",
  },
  KNEE: {
    "Flexion(fully bent)": "Flexion",
    "Extension(fully straight)": "Extension",
  },
  HIP: {
    "Internal Rotation": "Internal rotation",
    "External Rotation": "External rotation",
  },
};

/**
 * Resolve a BODY_PART_ROM movement name to its TEMPLATE_ROM equivalent.
 */
export function resolveTemplateMovementName(
  bp: string,
  bodyPartRomName: string,
): string {
  return MOVEMENT_NAME_MAP[bp]?.[bodyPartRomName] ?? bodyPartRomName;
}

/**
 * Map pain level (0-10) to template severity.
 */
export function getTemplateSeverityForPain(pain: number): Severity {
  if (pain <= 0) return "normal";
  if (pain <= 4) return "mild";
  if (pain <= 6) return "moderate";
  return "severe";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Map pain (0-10) to a continuous impairment score:
 * - 0.0 => normal best
 * - 1.x => mild band
 * - 2.x => moderate band
 * - 3.x => severe band
 *
 * This gives smooth progression inside each severity band (e.g. pain 6 -> 5).
 */
function painToContinuousImpairmentScore(pain: number): number {
  const p = clamp(pain, 0, 10);
  if (p <= 0) return 0;
  if (p <= 4) return 1 + ((p - 1) / 3) * 0.99;
  if (p <= 6) return 2 + ((p - 4) / 2) * 0.99;
  return 3 + ((p - 6) / 4) * 0.99;
}

function trendToImprovementBonus(trend: RomTrend | undefined): number {
  if (trend === "improved") return 0.08;
  if (trend === "slightly improved") return 0.04;
  return 0;
}

const SEVERITY_TO_INDEX: Record<Severity, number> = {
  normal: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

interface ScoredOption {
  degrees: number;
  score: number;
}

function buildScoredOptions(
  options: readonly { degrees: number; severity: Severity }[],
): ScoredOption[] {
  const result: ScoredOption[] = [];
  const severityOrder: readonly Severity[] = [
    "normal",
    "mild",
    "moderate",
    "severe",
  ];
  for (const severity of severityOrder) {
    const sameSeverity = options
      .filter((o) => o.severity === severity)
      .sort((a, b) => b.degrees - a.degrees);
    if (sameSeverity.length === 0) continue;
    const base = SEVERITY_TO_INDEX[severity];
    const denom = Math.max(1, sameSeverity.length - 1);
    sameSeverity.forEach((opt, idx) => {
      const withinBand = sameSeverity.length === 1 ? 0.5 : idx / denom;
      result.push({
        degrees: opt.degrees,
        score: base + withinBand * 0.95,
      });
    });
  }
  return result;
}

/**
 * Pick a degree value from TEMPLATE_ROM discrete options.
 *
 * @param bp - Body part key (must exist in TEMPLATE_ROM)
 * @param movementName - Movement name as it appears in TEMPLATE_ROM
 * @param severity - Target severity band to pick from
 * @param rngValue - A value in [0, 1) to select within the severity band
 * @returns The discrete degree value from the template, or null if movement not found
 */
export function pickTemplateROMDegrees(
  bp: BodyPartKey,
  movementName: string,
  severity: Severity,
  rngValue: number,
): number | null {
  const movements = TEMPLATE_ROM[bp];
  const movement = movements.find((m) => m.name === movementName);
  if (!movement) {
    return null;
  }

  let filtered = movement.options.filter((o) => o.severity === severity);

  // Fallback: if no options for this severity, pick closest available severity
  if (filtered.length === 0) {
    const fallbackOrder: Record<Severity, readonly Severity[]> = {
      normal: ["mild", "moderate", "severe"],
      mild: ["normal", "moderate", "severe"],
      moderate: ["mild", "severe", "normal"],
      severe: ["moderate", "mild", "normal"],
    };
    for (const fallback of fallbackOrder[severity]) {
      filtered = movement.options.filter((o) => o.severity === fallback);
      if (filtered.length > 0) break;
    }
  }

  // Safety: if still empty, use all options
  if (filtered.length === 0) {
    filtered = [...movement.options];
  }

  const index = Math.min(
    Math.floor(rngValue * filtered.length),
    filtered.length - 1,
  );
  return filtered[index].degrees;
}

/**
 * Pick template ROM degrees from continuous pain with trend/progress hints.
 *
 * This is used by TX rendering so ROM text can align with objective romTrend
 * and improve smoothly within the same severity band.
 */
export function pickTemplateROMDegreesByPain(
  bp: BodyPartKey,
  movementName: string,
  pain: number,
  rngValue: number,
  hints?: TemplateRomPainPickHints,
): number | null {
  const movements = TEMPLATE_ROM[bp];
  const movement = movements.find((m) => m.name === movementName);
  if (!movement) {
    return null;
  }

  const scored = buildScoredOptions(movement.options);
  if (scored.length === 0) {
    return null;
  }

  // Apply minDegrees floor: filter out options below the previous visit's value.
  // For non-stable trends, prefer a strictly higher degree when template options allow it.
  const minDeg = hints?.minDegrees ?? 0;
  const eligible = minDeg > 0 ? scored.filter((o) => o.degrees >= minDeg) : scored;
  // If all options are below floor (shouldn't happen), fall back to unfiltered.
  let candidates = eligible.length > 0 ? eligible : scored;
  const needsStrictIncrease =
    minDeg > 0 &&
    (hints?.trend === "improved" || hints?.trend === "slightly improved");
  if (needsStrictIncrease) {
    const strictlyHigher = candidates.filter((o) => o.degrees > minDeg);
    if (strictlyHigher.length > 0) {
      candidates = strictlyHigher;
    }
  }

  const progressBonus = clamp(hints?.progress ?? 0, 0, 1) * 0.2;
  const trendBonus = trendToImprovementBonus(hints?.trend);
  const jitter = (clamp(rngValue, 0, 0.999) - 0.5) * 0.24;
  const targetScore = clamp(
    painToContinuousImpairmentScore(pain) - progressBonus - trendBonus + jitter,
    0,
    3.99,
  );

  const picked = candidates.reduce((best, cur) => {
    const bestDiff = Math.abs(best.score - targetScore);
    const curDiff = Math.abs(cur.score - targetScore);
    if (curDiff < bestDiff) return cur;
    // Tie-break toward higher degree (less limitation).
    if (curDiff === bestDiff && cur.degrees > best.degrees) return cur;
    return best;
  }, candidates[0]);

  return picked.degrees;
}

/**
 * Get the severity label for a picked degree value from TEMPLATE_ROM.
 * Used to output "(normal)", "(mild)", etc. in the note text.
 */
export function getTemplateSeverityLabel(
  bp: BodyPartKey,
  movementName: string,
  degrees: number,
): string {
  const movements = TEMPLATE_ROM[bp];
  const movement = movements.find((m) => m.name === movementName);
  if (!movement) return "moderate";
  const option = movement.options.find((o) => o.degrees === degrees);
  return option?.severity ?? "moderate";
}
