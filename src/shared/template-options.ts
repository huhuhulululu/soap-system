/**
 * Canonical source of all MDLand template dropdown values.
 * Extracted verbatim from AC-IE *.md template HTML files.
 *
 * CRITICAL: All strings must match the template EXACTLY (case-sensitive,
 * including spaces and special characters).
 */

// ─── Types ───────────────────────────────────────────────────────────

export type Severity = "normal" | "mild" | "moderate" | "severe";

export interface ROMOption {
  readonly degrees: number;
  readonly severity: Severity;
}

export interface ROMMovementOptions {
  readonly name: string;
  readonly options: readonly ROMOption[];
}

export interface BodyPartMuscles {
  readonly tightness: readonly string[];
  readonly tenderness: readonly string[];
  readonly spasm: readonly string[];
}

export type BodyPartKey =
  | "LBP"
  | "NECK"
  | "SHOULDER"
  | "KNEE"
  | "ELBOW"
  | "HIP"
  | "THIGH";

// ─── Pain Types ──────────────────────────────────────────────────────

const PAIN_TYPES_WITH_PIN_NEEDLES = [
  "Dull",
  "Burning",
  "Freezing",
  "Shooting",
  "Tingling",
  "Stabbing",
  "Aching",
  "Squeezing",
  "Cramping",
  "pricking",
  "weighty",
  "cold",
  "pin & needles",
] as const;

const PAIN_TYPES_WITHOUT_PIN_NEEDLES = [
  "Dull",
  "Burning",
  "Freezing",
  "Shooting",
  "Tingling",
  "Stabbing",
  "Aching",
  "Squeezing",
  "Cramping",
  "pricking",
  "weighty",
  "cold",
] as const;

export const TEMPLATE_PAIN_TYPES: Record<BodyPartKey, readonly string[]> = {
  LBP: PAIN_TYPES_WITH_PIN_NEEDLES,
  NECK: PAIN_TYPES_WITH_PIN_NEEDLES,
  SHOULDER: PAIN_TYPES_WITH_PIN_NEEDLES,
  KNEE: PAIN_TYPES_WITH_PIN_NEEDLES,
  ELBOW: PAIN_TYPES_WITHOUT_PIN_NEEDLES,
  HIP: PAIN_TYPES_WITH_PIN_NEEDLES,
  THIGH: PAIN_TYPES_WITH_PIN_NEEDLES,
} as const;

// ─── Muscles ─────────────────────────────────────────────────────────

const LBP_MUSCLES = [
  "iliocostalis",
  "spinalis",
  "longissimus",
  "Iliopsoas Muscle",
  "Quadratus Lumborum",
  "Gluteal Muscles",
  "The Multifidus muscles",
] as const;

const NECK_MUSCLES = [
  "Scalene anterior / med / posterior",
  "Levator Scapulae",
  "Trapezius",
  "sternocleidomastoid muscles",
] as const;

const SHOULDER_MUSCLES = [
  "upper trapezius",
  "greater tuberosity",
  "lesser tuberosity",
  "AC joint",
  "levator scapula",
  "rhomboids",
  "middle deltoid",
  "deltoid ant fibres",
  "bicep long head",
  "supraspinatus",
  "triceps short head",
] as const;

const KNEE_MUSCLES = [
  "Gluteus Maximus",
  "Gluteus medius / minimus",
  "Piriformis muscle",
  "Quadratus femoris",
  "Adductor longus/ brev/ magnus",
  "Iliotibial Band ITB",
  "Rectus Femoris",
  "Gastronemius muscle",
  "Hamstrings muscle group",
  "Tibialis Post/ Anterior",
  "Plantar Fasciitis",
  "Intrinsic Foot Muscle group",
  "Achilles Tendon",
] as const;

const ELBOW_TIGHTNESS_MUSCLES = [
  "Lattisimus dorsi",
  "Internal oblique",
  "External oblique",
  "Erector spinae",
  "Hamstrings",
  "Gluteus Maximus",
] as const;

const ELBOW_TENDERNESS_MUSCLES = [
  "Lattisimus dorsi",
  "Internal oblique",
  "External oblique",
  "Erector spinae",
  "Hamstrings",
  "Gluteus Maximus",
  "Illiac Crest",
  "s2-s4",
  "L2-L5",
] as const;

const HIP_THIGH_MUSCLES = [
  "greater tubercle",
  "lesser tubercle",
  "piriformis",
  "gluteus maximus",
  "iliopsoas",
  "TFL",
  "IT band",
  "quadriceps",
  "rectus femoris",
  "hamstrings",
] as const;

const HIP_THIGH_SPASM_MUSCLES = [
  "Quadratus Lumborum",
  "Tensor Fascia Latae",
  "Piriformis",
] as const;

export const TEMPLATE_MUSCLES: Record<BodyPartKey, BodyPartMuscles> = {
  LBP: {
    tightness: LBP_MUSCLES,
    tenderness: LBP_MUSCLES,
    spasm: LBP_MUSCLES,
  },
  NECK: {
    tightness: NECK_MUSCLES,
    tenderness: NECK_MUSCLES,
    spasm: NECK_MUSCLES,
  },
  SHOULDER: {
    tightness: SHOULDER_MUSCLES,
    tenderness: SHOULDER_MUSCLES,
    spasm: SHOULDER_MUSCLES,
  },
  KNEE: {
    tightness: KNEE_MUSCLES,
    tenderness: KNEE_MUSCLES,
    spasm: KNEE_MUSCLES,
  },
  ELBOW: {
    tightness: ELBOW_TIGHTNESS_MUSCLES,
    tenderness: ELBOW_TENDERNESS_MUSCLES,
    spasm: ELBOW_TIGHTNESS_MUSCLES,
  },
  HIP: {
    tightness: HIP_THIGH_MUSCLES,
    tenderness: HIP_THIGH_MUSCLES,
    spasm: HIP_THIGH_SPASM_MUSCLES,
  },
  THIGH: {
    tightness: HIP_THIGH_MUSCLES,
    tenderness: HIP_THIGH_MUSCLES,
    spasm: HIP_THIGH_SPASM_MUSCLES,
  },
} as const;

// ─── ROM Helper ──────────────────────────────────────────────────────

function rom(degrees: number, severity: Severity): ROMOption {
  return { degrees, severity };
}

function movement(
  name: string,
  options: readonly ROMOption[],
): ROMMovementOptions {
  return { name, options };
}

// ─── ROM Data ────────────────────────────────────────────────────────

const LBP_ROM: readonly ROMMovementOptions[] = [
  movement("Flexion", [
    rom(90, "normal"),
    rom(85, "normal"),
    rom(80, "normal"),
    rom(75, "mild"),
    rom(70, "mild"),
    rom(65, "mild"),
    rom(60, "moderate"),
    rom(55, "moderate"),
    rom(50, "moderate"),
    rom(45, "moderate"),
    rom(40, "moderate"),
    rom(35, "severe"),
    rom(30, "severe"),
    rom(25, "severe"),
    rom(15, "severe"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
  movement("Extension", [
    rom(30, "normal"),
    rom(25, "mild"),
    rom(20, "moderate"),
    rom(15, "moderate"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
  movement("Rotation to Right", [
    rom(30, "normal"),
    rom(25, "mild"),
    rom(20, "moderate"),
    rom(15, "moderate"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
  movement("Rotation to Left", [
    rom(30, "normal"),
    rom(25, "mild"),
    rom(20, "moderate"),
    rom(15, "moderate"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
  movement("Flexion to the Right", [
    rom(30, "normal"),
    rom(25, "mild"),
    rom(20, "moderate"),
    rom(15, "moderate"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
  movement("Flexion to the Left", [
    rom(30, "normal"),
    rom(25, "mild"),
    rom(20, "moderate"),
    rom(15, "moderate"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
] as const;

const NECK_ROM: readonly ROMMovementOptions[] = [
  movement("Extension", [
    rom(5, "severe"),
    rom(10, "severe"),
    rom(15, "severe"),
    rom(20, "moderate"),
    rom(25, "moderate"),
    rom(30, "moderate"),
    rom(35, "mild"),
    rom(40, "mild"),
    rom(45, "normal"),
    rom(55, "normal"),
    rom(65, "normal"),
  ]),
  movement("Flexion", [
    rom(5, "severe"),
    rom(10, "severe"),
    rom(15, "severe"),
    rom(20, "moderate"),
    rom(25, "moderate"),
    rom(30, "mild"),
    rom(35, "mild"),
    rom(40, "normal"),
    rom(50, "normal"),
  ]),
  movement("Rotation to Right", [
    rom(10, "severe"),
    rom(15, "severe"),
    rom(20, "severe"),
    rom(25, "severe"),
    rom(30, "moderate"),
    rom(35, "moderate"),
    rom(40, "moderate"),
    rom(45, "moderate"),
    rom(50, "mild"),
    rom(55, "mild"),
    rom(60, "mild"),
    rom(65, "mild"),
    rom(70, "normal"),
  ]),
  movement("Rotation to Left", [
    rom(10, "severe"),
    rom(15, "severe"),
    rom(20, "severe"),
    rom(25, "severe"),
    rom(30, "moderate"),
    rom(35, "moderate"),
    rom(40, "moderate"),
    rom(45, "moderate"),
    rom(50, "mild"),
    rom(55, "mild"),
    rom(60, "mild"),
    rom(65, "mild"),
    rom(70, "normal"),
  ]),
  movement("Lateral Flexion to the Right", [
    rom(10, "severe"),
    rom(15, "severe"),
    rom(20, "moderate"),
    rom(25, "moderate"),
    rom(30, "mild"),
    rom(35, "mild"),
    rom(40, "normal"),
  ]),
  movement("Lateral Flexion to the Left", [
    rom(10, "severe"),
    rom(15, "severe"),
    rom(20, "moderate"),
    rom(25, "moderate"),
    rom(30, "mild"),
    rom(35, "mild"),
    rom(40, "normal"),
  ]),
] as const;

const SHOULDER_ROM: readonly ROMMovementOptions[] = [
  movement("Abduction", [
    rom(180, "normal"),
    rom(175, "normal"),
    rom(170, "normal"),
    rom(165, "mild"),
    rom(160, "mild"),
    rom(155, "mild"),
    rom(150, "mild"),
    rom(145, "moderate"),
    rom(140, "moderate"),
    rom(135, "moderate"),
    rom(130, "moderate"),
    rom(125, "moderate"),
    rom(120, "moderate"),
    rom(115, "moderate"),
    rom(110, "moderate"),
    rom(105, "moderate"),
    rom(100, "moderate"),
    rom(95, "moderate"),
    rom(90, "severe"),
    rom(85, "severe"),
    rom(80, "severe"),
    rom(75, "severe"),
    rom(70, "severe"),
    rom(65, "severe"),
    rom(60, "severe"),
    rom(55, "severe"),
    rom(50, "severe"),
    rom(45, "severe"),
    rom(40, "severe"),
    rom(35, "severe"),
    rom(30, "severe"),
    rom(25, "severe"),
    rom(20, "severe"),
    rom(15, "severe"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
  movement("Horizontal Adduction", [
    rom(45, "normal"),
    rom(40, "normal"),
    rom(35, "normal"),
    rom(30, "normal"),
    rom(25, "mild"),
    rom(20, "mild"),
    rom(15, "moderate"),
    rom(10, "moderate"),
    rom(5, "severe"),
  ]),
  movement("Flexion", [
    rom(180, "normal"),
    rom(175, "normal"),
    rom(170, "normal"),
    rom(165, "mild"),
    rom(160, "mild"),
    rom(155, "mild"),
    rom(150, "mild"),
    rom(145, "moderate"),
    rom(140, "moderate"),
    rom(135, "moderate"),
    rom(130, "moderate"),
    rom(125, "moderate"),
    rom(120, "moderate"),
    rom(115, "moderate"),
    rom(110, "moderate"),
    rom(105, "moderate"),
    rom(100, "moderate"),
    rom(95, "moderate"),
    rom(90, "severe"),
    rom(85, "severe"),
    rom(80, "severe"),
    rom(75, "severe"),
    rom(70, "severe"),
    rom(65, "severe"),
    rom(60, "severe"),
    rom(55, "severe"),
    rom(50, "severe"),
    rom(45, "severe"),
    rom(40, "severe"),
    rom(35, "severe"),
    rom(30, "severe"),
    rom(25, "severe"),
    rom(20, "severe"),
    rom(15, "severe"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
  movement("Extension", [
    rom(5, "severe"),
    rom(10, "severe"),
    rom(15, "severe"),
    rom(20, "moderate"),
    rom(25, "moderate"),
    rom(30, "moderate"),
    rom(35, "moderate"),
    rom(40, "mild"),
    rom(45, "mild"),
    rom(50, "mild"),
    rom(55, "normal"),
    rom(60, "normal"),
  ]),
  movement("External rotation", [
    rom(90, "normal"),
    rom(85, "normal"),
    rom(80, "normal"),
    rom(75, "mild"),
    rom(70, "mild"),
    rom(65, "mild"),
    rom(60, "moderate"),
    rom(55, "moderate"),
    rom(50, "moderate"),
    rom(45, "moderate"),
    rom(40, "moderate"),
    rom(35, "severe"),
    rom(30, "severe"),
    rom(25, "severe"),
    rom(15, "severe"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
  movement("Internal rotation", [
    rom(90, "normal"),
    rom(85, "normal"),
    rom(80, "normal"),
    rom(75, "mild"),
    rom(70, "mild"),
    rom(65, "mild"),
    rom(60, "moderate"),
    rom(55, "moderate"),
    rom(50, "moderate"),
    rom(45, "moderate"),
    rom(40, "moderate"),
    rom(35, "severe"),
    rom(30, "severe"),
    rom(25, "severe"),
    rom(15, "severe"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
] as const;

const KNEE_ROM: readonly ROMMovementOptions[] = [
  movement("Flexion", [
    rom(130, "normal"),
    rom(125, "normal"),
    rom(120, "normal"),
    rom(115, "mild"),
    rom(110, "mild"),
    rom(105, "mild"),
    rom(100, "moderate"),
    rom(95, "moderate"),
    rom(90, "moderate"),
    rom(85, "moderate"),
    rom(80, "moderate"),
    rom(75, "moderate"),
    rom(70, "moderate"),
    rom(65, "severe"),
    rom(60, "severe"),
    rom(55, "severe"),
    rom(50, "severe"),
    rom(45, "severe"),
    rom(40, "severe"),
    rom(35, "severe"),
    rom(30, "severe"),
    rom(25, "severe"),
  ]),
  movement("Extension", [rom(0, "normal"), rom(-5, "severe")]),
] as const;

const ELBOW_ROM: readonly ROMMovementOptions[] = [
  movement("Flexion", [
    rom(150, "normal"),
    rom(145, "normal"),
    rom(140, "normal"),
    rom(135, "normal"),
    rom(130, "normal"),
    rom(125, "normal"),
    rom(120, "normal"),
    rom(115, "mild"),
    rom(110, "mild"),
    rom(105, "mild"),
    rom(100, "mild"),
    rom(95, "mild"),
    rom(90, "mild"),
    rom(85, "moderate"),
    rom(80, "moderate"),
    rom(75, "moderate"),
    rom(70, "moderate"),
    rom(65, "moderate"),
    rom(60, "moderate"),
    rom(55, "moderate"),
    rom(50, "moderate"),
    rom(45, "moderate"),
    rom(40, "moderate"),
    rom(35, "severe"),
    rom(30, "severe"),
    rom(25, "severe"),
    rom(20, "severe"),
    rom(15, "severe"),
    rom(10, "severe"),
    rom(5, "severe"),
    rom(0, "severe"),
  ]),
  movement("Extension", [rom(10, "normal"), rom(5, "mild")]),
  movement("Left side flexion", [
    rom(85, "normal"),
    rom(80, "normal"),
    rom(75, "normal"),
    rom(70, "normal"),
    rom(65, "normal"),
    rom(60, "normal"),
    rom(55, "normal"),
    rom(50, "normal"),
    rom(45, "mild"),
    rom(40, "mild"),
    rom(35, "moderate"),
    rom(30, "moderate"),
    rom(25, "moderate"),
    rom(20, "moderate"),
    rom(15, "severe"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
  movement("Rt side flexion", [
    rom(85, "normal"),
    rom(80, "normal"),
    rom(75, "normal"),
    rom(70, "normal"),
    rom(65, "normal"),
    rom(60, "normal"),
    rom(55, "normal"),
    rom(50, "normal"),
    rom(45, "mild"),
    rom(40, "mild"),
    rom(35, "moderate"),
    rom(30, "moderate"),
    rom(25, "moderate"),
    rom(20, "moderate"),
    rom(15, "severe"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
  movement("Left side rotation", [
    rom(85, "normal"),
    rom(80, "normal"),
    rom(75, "normal"),
    rom(70, "normal"),
    rom(65, "normal"),
    rom(60, "normal"),
    rom(55, "normal"),
    rom(50, "normal"),
    rom(45, "mild"),
    rom(40, "mild"),
    rom(35, "moderate"),
    rom(30, "moderate"),
    rom(25, "moderate"),
    rom(20, "moderate"),
    rom(15, "severe"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
  movement("Right side rotation", [
    rom(85, "normal"),
    rom(80, "normal"),
    rom(75, "normal"),
    rom(70, "normal"),
    rom(65, "normal"),
    rom(60, "normal"),
    rom(55, "normal"),
    rom(50, "normal"),
    rom(45, "mild"),
    rom(40, "mild"),
    rom(35, "moderate"),
    rom(30, "moderate"),
    rom(25, "moderate"),
    rom(20, "moderate"),
    rom(15, "severe"),
    rom(10, "severe"),
    rom(5, "severe"),
  ]),
] as const;

const HIP_ROM: readonly ROMMovementOptions[] = [
  movement("Abduction", [
    rom(30, "normal"),
    rom(25, "normal"),
    rom(20, "mild"),
    rom(15, "mild"),
    rom(10, "moderate"),
    rom(5, "severe"),
  ]),
  movement("Flexion", [
    rom(130, "normal"),
    rom(120, "normal"),
    rom(110, "normal"),
    rom(100, "mild"),
    rom(90, "mild"),
    rom(80, "mild"),
    rom(70, "moderate"),
    rom(60, "moderate"),
    rom(50, "moderate"),
    rom(40, "severe"),
    rom(30, "severe"),
    rom(20, "severe"),
    rom(10, "severe"),
  ]),
  movement("Extension", [
    rom(30, "normal"),
    rom(25, "normal"),
    rom(20, "mild"),
    rom(15, "moderate"),
    rom(10, "moderate"),
    rom(5, "severe"),
  ]),
  movement("External rotation", [
    rom(5, "severe"),
    rom(10, "severe"),
    rom(15, "severe"),
    rom(20, "moderate"),
    rom(25, "moderate"),
    rom(30, "mild"),
    rom(35, "mild"),
    rom(40, "normal"),
    rom(45, "normal"),
  ]),
  movement("Internal rotation", [
    rom(5, "severe"),
    rom(10, "severe"),
    rom(15, "severe"),
    rom(20, "moderate"),
    rom(25, "moderate"),
    rom(30, "mild"),
    rom(35, "mild"),
    rom(40, "normal"),
  ]),
] as const;

const THIGH_ROM: readonly ROMMovementOptions[] = [
  movement("Abduction", [
    rom(30, "normal"),
    rom(25, "normal"),
    rom(20, "mild"),
    rom(15, "mild"),
    rom(10, "moderate"),
    rom(5, "severe"),
  ]),
  movement("Flexion", [
    rom(130, "normal"),
    rom(120, "normal"),
    rom(110, "normal"),
    rom(100, "mild"),
    rom(90, "mild"),
    rom(80, "mild"),
    rom(70, "moderate"),
    rom(60, "moderate"),
    rom(50, "moderate"),
    rom(40, "severe"),
    rom(30, "severe"),
    rom(20, "severe"),
    rom(10, "severe"),
  ]),
  movement("Extension", [
    rom(30, "normal"),
    rom(25, "normal"),
    rom(20, "mild"),
    rom(15, "moderate"),
    rom(10, "moderate"),
    rom(5, "severe"),
  ]),
] as const;

export const TEMPLATE_ROM: Record<BodyPartKey, readonly ROMMovementOptions[]> =
  {
    LBP: LBP_ROM,
    NECK: NECK_ROM,
    SHOULDER: SHOULDER_ROM,
    KNEE: KNEE_ROM,
    ELBOW: ELBOW_ROM,
    HIP: HIP_ROM,
    THIGH: THIGH_ROM,
  } as const;

// ─── ADL ─────────────────────────────────────────────────────────────

export const TEMPLATE_ADL: Record<BodyPartKey, readonly string[]> = {
  LBP: [
    "performing household chores",
    "working long time in front of computer",
    "long hours of driving",
    "doing laundry",
    "Cooking",
    "Going up and down stairs",
    "Lifting objects",
    "Bending over to wear/tie a shoe",
    "Rising from a chair",
    "Standing for long periods of time",
    "Walking for long periods of time",
    "sitting for long periods of time",
    "Getting out of bed",
    "standing for cooking",
  ],
  NECK: [
    "gargling",
    "looking down watching steps",
    "turning the head when crossing the street",
    "tilting head to talking the phone",
    "sit and watching TV over 20 mins",
    "reading newspaper/book",
    "performing household chores",
    "carry/handing grocery bags",
    "cooking",
    "doing laundry",
    "washing hair",
    "showering",
    "running/jumping/participating in physical exercise",
    "driving",
  ],
  SHOULDER: [
    "holding the pot for cooking",
    "performing household chores",
    "working long time in front of computer",
    "long hours of driving",
    "pushing/pulling cart, box, door",
    "doing laundry",
    "handing/carrying moderate objects",
    "put on/take off the clothes",
    "reach top of cabinet to get object(s)",
    "reach to back to unzip",
    "raising up the hand to comb hair",
    "touch opposite side shoulder to put coat on",
    "abduct arm get the objects from other people",
    "adduction arm to put pant on",
  ],
  KNEE: [
    "performing household chores",
    "long hours of driving",
    "Going up and down stairs",
    "Bending over to wear/tie a shoe",
    "Rising from a chair",
    "Standing for long periods of time",
    "Walking for long periods of time",
    "Getting out of bed",
    "standing for cooking",
    "bending knee to sit position",
    "bending down put in/out of the shoes",
  ],
  ELBOW: [
    "holding the pot for cooking",
    "performing household chores",
    "working long time in front of computer",
    "long hours of driving",
    "pushing/pulling cart, box, door",
    "doing laundry",
    "handing/carrying moderate objects",
    "put on/take off the clothes",
    "reach top of cabinet to get object(s)",
    "reach to back to unzip",
    "raising up the hand to comb hair",
    "touch opposite side shoulder to put coat on",
    "abduct arm get the objects from other people",
    "adduction arm to put pant on",
  ],
  HIP: [
    "performing household chores",
    "working long time in front of computer",
    "long hours of driving",
    "doing laundry",
    "Cooking",
    "Sitting or standing for long periods of time",
    "Going up and down stairs",
    "Lifting objects",
    "Bending over to wear/tie a shoe",
    "Rising from a chair",
  ],
  THIGH: [
    "performing household chores",
    "get out/in the chair or bed",
    "standing without any help",
    "standing long hours during work",
    "standing for cooking",
    "standing over 20 mins",
    "working long time in front of computer",
    "long hours of driving",
    "sitting over 30 mins",
    "walking over 15 mins",
    "go up/down stairs",
    "pushing/pulling cart, box, door",
    "doing laundry",
    "bending down put in/out of the shoes",
    "bend forward get object from floor",
    "handing/carrying moderate objects",
  ],
} as const;

// ─── Aggravating Factors ─────────────────────────────────────────────

export const TEMPLATE_AGGRAVATING: Record<BodyPartKey, readonly string[]> = {
  LBP: [
    "any strenuous activities",
    "repetitive motions",
    "poor sleep",
    "mental stress",
    "extension",
    "flexion",
    "abduction",
    "adduction",
    "internal rotation",
    "external rotation",
    "sleep to the side",
    "Standing after sitting for long time",
    "Stair climbing",
    "Sitting on a low chair",
    "Sitting cross leg",
    "Prolong walking",
  ],
  NECK: [
    "any strenuous activities",
    "repetitive motions",
    "poor sleep",
    "mental stress",
    "extension",
    "flexion",
    "abduction",
    "adduction",
    "internal rotation",
    "external rotation",
    "sleep to the side",
    "Standing after sitting for long time",
    "Stair climbing",
    "Sitting on a low chair",
    "Sitting cross leg",
    "prolonged walking",
    "prolonged standing",
    "prolonged sitting",
    "lifted heavy objects",
  ],
  SHOULDER: [
    "any strenuous activities",
    "repetitive motions",
    "push the door",
    "extension",
    "flexion",
    "abduction",
    "adduction",
    "internal rotation",
    "external rotation",
    "sleep to the side",
    "Lifting heavy objects",
    "Overhead activities",
  ],
  KNEE: [
    "any strenuous activities",
    "repetitive motions",
    "poor sleep",
    "mental stress",
    "extension",
    "flexion",
    "abduction",
    "adduction",
    "internal rotation",
    "external rotation",
    "sleep to the side",
    "Standing after sitting for long time",
    "Stair climbing",
    "Sitting on a low chair",
    "Sitting cross leg",
    "Prolong walking",
  ],
  ELBOW: [
    "any strenuous activities",
    "repetitive motions",
    "poor sleep",
    "mental stress",
    "cold weather",
    "push the door",
    "extension",
    "flexion",
    "abduction",
    "adduction",
    "internal rotation",
    "external rotation",
    "sleep to the side",
  ],
  HIP: [
    "any strenuous activities",
    "repetitive motions",
    "poor sleep",
    "mental stress",
    "extension",
    "flexion",
    "abduction",
    "adduction",
    "internal rotation",
    "external rotation",
    "sleep to the side",
    "Prolonge walking",
    "Standing after sitting for long time",
    "Stair climbing",
    "Sitting on a low chair",
    "Sitting cross leg",
  ],
  THIGH: [
    "prolonged walking",
    "prolonged sitting",
    "prolonged standing",
    "sit to stand",
    "lifting",
    "repetitive motions",
    "stress emotion",
    "exposure to cold air",
    "poor sleep",
    "flexion",
    "extension",
    "rotation to right",
    "rotation to left",
    "lateral flexion to right",
    "lateral flexion to left",
  ],
} as const;

// ─── Relieving Factors ───────────────────────────────────────────────

const RELIEVING_WITH_MEDICATIONS = [
  "Moving around",
  "Changing positions",
  "Stretching",
  "Resting",
  "Lying down",
  "Applying heating pad",
  "Applying ice pad",
  "Leaning forward onto something",
  "Using of joint support",
  "Massage",
  "Medications",
] as const;

const RELIEVING_WITHOUT_MEDICATIONS = [
  "Moving around",
  "Changing positions",
  "Stretching",
  "Resting",
  "Lying down",
  "Applying heating pad",
  "Applying ice pad",
  "Leaning forward onto something",
  "Using of joint support",
  "Massage",
] as const;

export const TEMPLATE_RELIEVING: Record<BodyPartKey, readonly string[]> = {
  LBP: RELIEVING_WITH_MEDICATIONS,
  NECK: RELIEVING_WITHOUT_MEDICATIONS,
  SHOULDER: RELIEVING_WITHOUT_MEDICATIONS,
  KNEE: RELIEVING_WITH_MEDICATIONS,
  ELBOW: RELIEVING_WITHOUT_MEDICATIONS,
  HIP: RELIEVING_WITH_MEDICATIONS,
  THIGH: RELIEVING_WITHOUT_MEDICATIONS,
} as const;

// ─── Condition Impact ────────────────────────────────────────────────

const CONDITION_IMPACT_OPTIONS = [
  "decrease outside activity",
  "stay in bed",
  "decrease housework",
  "decrease standing time",
  "decrease walking time",
  "decrease sitting time",
  "decrease time working with computer",
  "decrease climb stairs",
  "decrease exercise",
  "normal activity",
  "maintain regular schedule",
  "irregular schedule",
] as const;

export const TEMPLATE_CONDITION_IMPACT: Record<BodyPartKey, readonly string[]> =
  {
    LBP: CONDITION_IMPACT_OPTIONS,
    NECK: CONDITION_IMPACT_OPTIONS,
    SHOULDER: CONDITION_IMPACT_OPTIONS,
    KNEE: CONDITION_IMPACT_OPTIONS,
    ELBOW: CONDITION_IMPACT_OPTIONS,
    HIP: CONDITION_IMPACT_OPTIONS,
    THIGH: CONDITION_IMPACT_OPTIONS,
  } as const;

// ─── Causative Factors ───────────────────────────────────────────────

const CAUSATIVES_FULL = [
  "age related/degenerative changes",
  "expose to the cold air for more than 20 mins",
  "live in too cold environment",
  "weather change",
  "poor sleep",
  "over used due to heavy household chores",
  "over used due to nature of work",
  "excessive used of phone/tablet",
  "overworking in computer",
  "prolong walking",
  "prolong sitting",
  "longtime driving",
  "sitting over 30 mins with bad posture",
  "climb too much stairs",
  "intense excise",
  "lifting too much weight",
  "hurt myself during exercise",
  "repetitive injury from past work",
  "repetitive strain from activities in the past",
  "strain when pick up heavy object from floor",
  "sprain when pick up heavy object from floor",
  "recent sprain",
  "sprain",
  "fell (no sign of fracture)",
] as const;

const CAUSATIVES_KNEE = [
  "age related/degenerative changes",
  "expose to the cold air for more than 20 mins",
  "live in too cold environment",
  "poor sleep",
  "over used due to heavy household chores",
  "over used due to nature of work",
  "overworking in computer",
  "prolong walking",
  "intense excise",
  "lifting too much weight",
  "repetitive injury from past work",
  "repetitive strain from activities in the past",
  "strain when pick up heavy object from floor",
  "sprain when pick up heavy object from floor",
  "recent sprain",
  "sprain",
  "Recent fall (no sign of fracture)",
  "Inactive lifestyle",
  "Bad Posture",
  "weather changed/cold weather",
] as const;

const CAUSATIVES_HIP = [
  "age related/degenerative changes",
  "expose to the cold air for more than 20 mins",
  "live in too cold environment",
  "poor sleep",
  "over used due to heavy household chores",
  "over used due to nature of work",
  "overworking in computer",
  "prolong walking",
  "intense excise",
  "lifting too much weight",
  "repetitive injury from past work",
  "repetitive strain from activities in the past",
  "strain when pick up heavy object from floor",
  "sprain when pick up heavy object from floor",
  "recent sprain",
  "sprain",
  "Recent fall (no sign of fracture)",
  "Inactive lifestyle",
  "Bad Posture",
] as const;

export const TEMPLATE_CAUSATIVES: Record<BodyPartKey, readonly string[]> = {
  LBP: CAUSATIVES_FULL,
  NECK: CAUSATIVES_FULL,
  SHOULDER: CAUSATIVES_FULL,
  KNEE: CAUSATIVES_KNEE,
  ELBOW: CAUSATIVES_FULL,
  HIP: CAUSATIVES_HIP,
  THIGH: CAUSATIVES_FULL,
} as const;

// ─── Treatment Verb (来自各模板 ppnSelectCombo) ─────────────────────

export const TEMPLATE_TREATMENT_VERB: Record<BodyPartKey, string> = {
  SHOULDER: "emphasize",
  KNEE: "focus",
  NECK: "pay attention",
  LBP: "promote",
  ELBOW: "promote",
  HIP: "promote",
  THIGH: "promote",
} as const;

// ─── Harmonize (来自各模板 ppnSelectCombo) ───────────────────────────

export const TEMPLATE_HARMONIZE: Record<BodyPartKey, string> = {
  SHOULDER: "healthy qi and to expel pathogen factor to promote",
  KNEE: "Liver and Kidney",
  LBP: "yin/yang",
  NECK: "yin/yang",
  ELBOW: "yin/yang",
  HIP: "yin/yang",
  THIGH: "yin/yang",
} as const;

// ─── Treatment Purpose (来自各模板 ppnSelectCombo) ───────────────────

export const TEMPLATE_TREATMENT_PURPOSE: Record<BodyPartKey, string> = {
  SHOULDER: "to reduce stagnation and improve circulation",
  KNEE: "promote healthy joint and lessen dysfunction in all aspects",
  LBP: "promote good essence",
  NECK: "promote good essence",
  ELBOW: "promote good essence",
  HIP: "promote good essence",
  THIGH: "promote good essence",
} as const;

// ─── Needle Points (from needles/*.md templates ppnSelectCombo) ─────

export interface NeedlePointsEntry {
  readonly frontPool: readonly string[];
  readonly backPool: readonly string[];
  readonly hasSide: boolean;
}

export const TEMPLATE_NEEDLE_POINTS: Record<BodyPartKey, NeedlePointsEntry> = {
  SHOULDER: {
    frontPool: [
      "JIAN QIAN",
      "PC2",
      "LU3",
      "LU4",
      "LU5",
      "LI4",
      "LI11",
      "ST3",
      "GB34",
      "SI3",
      "ST38",
    ],
    backPool: [
      "GB21",
      "BL10",
      "BL11",
      "BL17",
      "LI15",
      "LI16",
      "SI9",
      "SI10",
      "SI11",
      "SI12",
      "SI14",
      "SI15",
      "SJ10",
      "A SHI POINTS",
    ],
    hasSide: true,
  },
  KNEE: {
    frontPool: [
      "GB33",
      "GB34",
      "GB36",
      "GB39",
      "UB40",
      "ST34",
      "ST35",
      "ST36",
      "ST40",
      "SP3",
      "SP9",
      "SP10",
      "KD3",
      "KD10",
      "XI YAN",
      "LV4",
      "REN4",
      "HE DING",
      "A SHI POINT",
    ],
    backPool: [
      "BL23",
      "BL20",
      "BL40",
      "BL55",
      "BL38",
      "BL56",
      "BL57",
      "A SHI POINTS",
    ],
    hasSide: true,
  },
  LBP: {
    frontPool: ["REN6", "GB34", "ST36", "ST40", "REN4", "SI3"],
    backPool: [
      "BL23",
      "BL25",
      "BL53",
      "DU4",
      "BL22",
      "YAO JIA JI",
      "A SHI POINTS",
    ],
    hasSide: false,
  },
  NECK: {
    frontPool: ["LI4", "GB39", "SI3", "LU7"],
    backPool: ["GB20", "GB21", "BL10", "BL11", "A SHI POINTS"],
    hasSide: false,
  },
  ELBOW: {
    frontPool: ["LI10", "LI11", "LU5", "HT3"],
    backPool: ["LI12", "SI8", "A SHI POINTS"],
    hasSide: true,
  },
  HIP: {
    frontPool: ["GB34", "ST36", "SP6", "LV3"],
    backPool: ["GB29", "GB30", "BL54", "A SHI POINTS"],
    hasSide: false,
  },
  THIGH: {
    frontPool: ["GB34", "ST36", "SP6", "LV3"],
    backPool: ["GB29", "GB30", "BL54", "A SHI POINTS"],
    hasSide: false,
  },
};

// ─── Needle Size (from needles/*.md templates) ───────────────────────

export const TEMPLATE_NEEDLE_SIZE: Record<BodyPartKey, string> = {
  SHOULDER: 'Select Needle Size :36#x0.5" , 34#x1" ,30# x1.5"',
  KNEE: 'Select Needle Size : 34#x1" ,30# x1.5",30# x2"',
  LBP: 'Select Needle Size : 34#x1" ,30# x1.5",30# x2",30#x3"',
  NECK: 'Select Needle Size :36#x0.5" , 34#x1" ,30# x1.5"',
  ELBOW: 'Select Needle Size :36#x0.5" , 34#x1" ,30# x1.5"',
  HIP: 'Select Needle Size : 34#x1" ,30# x1.5",30# x2",30#x3"',
  THIGH: 'Select Needle Size : 34#x1" ,30# x1.5",30# x2",30#x3"',
};

// ─── Tenderness Scale (from IE/TX templates ppnSelectComboSingle) ────

export const TEMPLATE_TENDERNESS_SCALE: Record<
  BodyPartKey,
  Record<string, string>
> = {
  SHOULDER: {
    "+4": "(+4) = Patient complains of severe tenderness, withdraws immediately in response to test pressure, and is unable to bear sustained pressure",
    "+3": "(+3) = Patient complains of considerable tenderness and withdraws momentarily in response to the test pressure",
    "+2": "(+2) = Patient states that the area is moderately tender",
    "+1": "(+1)=Patient states that the area is mildly tender-annoying",
  },
  KNEE: {
    "+4": "(+4) = There is severe tenderness and withdrawal response from the patient when there is noxious stimulus",
    "+3": "(+3) = There is severe tenderness with withdrawal",
    "+2": "(+2) = There is mild tenderness with grimace and flinch to moderate palpation",
    "+1": "(+1)= There is mild tenderness to palpation",
    "0": "(0) = No tenderness",
  },
  LBP: {
    "+4": "(+4) = There is severe tenderness and withdrawal response from the patient when there is noxious stimulus",
    "+3": "(+3) = There is severe tenderness with withdrawal",
    "+2": "(+2) = There is mild tenderness with grimace and flinch to moderate palpation",
    "+1": "(+1)= There is mild tenderness to palpation",
    "0": "(0) = No tenderness",
  },
  NECK: {
    "+4": "(+4) = There is severe tenderness and withdrawal response from the patient when there is noxious stimulus",
    "+3": "(+3) = There is severe tenderness with withdrawal",
    "+2": "(+2) = There is mild tenderness with grimace and flinch to moderate palpation",
    "+1": "(+1)= There is mild tenderness to palpation",
    "0": "(0) = No tenderness",
  },
  ELBOW: {
    "+4": "(+4) = There is severe tenderness and withdrawal response from the patient when there is noxious stimulus",
    "+3": "(+3) = There is severe tenderness with withdrawal",
    "+2": "(+2) = There is mild tenderness with grimace and flinch to moderate palpation",
    "+1": "(+1)= There is mild tenderness to palpation",
    "0": "(0) = No tenderness",
  },
  HIP: {
    "+4": "(+4) = There is severe tenderness and withdrawal response from the patient when there is noxious stimulus",
    "+3": "(+3) = There is severe tenderness with withdrawal",
    "+2": "(+2) = There is mild tenderness with grimace and flinch to moderate palpation",
    "+1": "(+1)= There is mild tenderness to palpation",
    "0": "(0) = No tenderness",
  },
  THIGH: {
    "+4": "(+4) = There is severe tenderness and withdrawal response from the patient when there is noxious stimulus",
    "+3": "(+3) = There is severe tenderness with withdrawal",
    "+2": "(+2) = There is mild tenderness with grimace and flinch to moderate palpation",
    "+1": "(+1)= There is mild tenderness to palpation",
    "0": "(0) = No tenderness",
  },
};

// ─── Tenderness Text (from IE/TX templates) ──────────────────────────

export const TEMPLATE_TENDERNESS_TEXT: Record<BodyPartKey, string> = {
  SHOULDER: "Tenderness muscles noted along",
  KNEE: "Tenderness muscle noted along",
  LBP: "Tenderness muscle noted along",
  NECK: "Tenderness muscle noted along",
  ELBOW: "Tenderness muscle noted along",
  HIP: "Tenderness muscle noted along",
  THIGH: "Tenderness muscle noted along",
};

// ─── TX Plan Verb (来自各 TX 模板 ppnSelectCombo) ────────────────────

export const TEMPLATE_TX_VERB: readonly string[] = [
  "continue to be emphasize",
  "emphasize",
  "consist of promoting",
  "promote",
  "focus",
  "pay attention",
] as const;

// ─── TX Reason (REASON2 dropdown — 24 options) ─────────────────────

export const TEMPLATE_TX_REASON = [
  "can move joint more freely and with less pain",
  "physical activity no longer causes distress",
  "reduced level of pain",
  "reduced joint stiffness and swelling",
  "less difficulty performing daily activities",
  "energy level improved",
  "sleep quality improved",
  "more energy level throughout the day",
  "continuous treatment",
  "maintain regular treatments",
  "still need more treatments to reach better effect",
  "weak constitution",
  "skipped treatments",
  "stopped treatment for a while",
  "discontinuous treatment",
  "did not have good rest",
  "intense work",
  "excessive time using cell phone",
  "excessive time using computer",
  "bad posture",
  "carrying/lifting heavy object(s)",
  "lack of exercise",
  "exposure to cold air",
  "uncertain reason",
] as const;

// ─── TX Adverse Effect (fixed static text) ──────────────────────────

export const TEMPLATE_TX_ADVERSE =
  "No adverse side effect post treatment." as const;

// ─── TX What Changed (Assessment dropdown — 10 options) ─────────────

export const TEMPLATE_TX_WHAT_CHANGED = [
  "pain",
  "pain frequency",
  "pain duration",
  "numbness sensation",
  "muscles weakness",
  "muscles soreness sensation",
  "muscles stiffness sensation",
  "heaviness sensation",
  "difficulty in performing ADLs",
  "as last time visit",
] as const;

// ─── TX Symptom Change (Subjective dropdown — 4 options) ─────────────

export const TEMPLATE_TX_SYMPTOM_CHANGE = [
  "improvement of symptom(s)",
  "slight improvement of symptom(s)",
  "exacerbate of symptom(s)",
  "similar symptom(s) as last visit",
  "improvement after treatment, but pain still came back next day",
] as const;

// ─── TX Connector (Subjective dropdown — 4 options) ──────────────────

export const TEMPLATE_TX_CONNECTOR = [
  "because of",
  "may related of",
  "due to",
  "and",
] as const;

// ─── TX General Condition (Subjective dropdown — 3 options) ──────────

export const TEMPLATE_TX_GENERAL_CONDITION = [
  "good",
  "fair",
  "poor",
] as const;

// ─── TX Symptom Present (Assessment dropdown — 4 options) ────────────

export const TEMPLATE_TX_SYMPTOM_PRESENT = [
  "slight improvement of symptom(s).",
  "improvement of symptom(s).",
  "exacerbate of symptom(s).",
  "no change.",
] as const;

// ─── TX Patient Change (Assessment dropdown — 5 options) ─────────────

export const TEMPLATE_TX_PATIENT_CHANGE = [
  "decreased",
  "slightly decreased",
  "increased",
  "slight increased",
  "remained the same",
] as const;

// ─── TX Physical Change (Assessment dropdown — 5 options) ────────────

export const TEMPLATE_TX_PHYSICAL_CHANGE = [
  "reduced",
  "slightly reduced",
  "increased",
  "slight increased",
  "remained the same",
] as const;

// ─── TX Finding Type (Assessment dropdown — 9 options) ───────────────

export const TEMPLATE_TX_FINDING_TYPE = [
  "local muscles tightness",
  "local muscles tenderness",
  "local muscles spasms",
  "local muscles trigger points",
  "joint ROM",
  "joint ROM limitation",
  "muscles strength",
  "joints swelling",
  "last visit",
] as const;

// ─── TX Tolerated (Assessment dropdown — 4 options) ──────────────────

export const TEMPLATE_TX_TOLERATED = [
  "session",
  "treatment",
  "acupuncture session",
  "acupuncture treatment",
] as const;

// ─── TX Response (Assessment dropdown — 12 options) ──────────────────

export const TEMPLATE_TX_RESPONSE = [
  "well",
  "with good positioning technique",
  "with good draping technique",
  "with positive verbal response",
  "with good response",
  "with positive response",
  "with good outcome in reducing spasm",
  "with excellent outcome due reducing pain",
  "with good outcome in improving ROM",
  "good outcome in improving ease with functional mobility",
  "with increase ease with functional mobility",
  "with increase ease with function",
] as const;
