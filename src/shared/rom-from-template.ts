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
  if (pain <= 3) return "mild";
  if (pain <= 6) return "moderate";
  return "severe";
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
