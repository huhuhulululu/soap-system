import type { GeneratorRule } from "../../types";
import { err } from "../shared";

const MUSCLE_KEYWORDS: Record<string, string[]> = {
  KNEE: [
    "gluteus", "piriformis", "quadratus", "adductor", "ITB", "rectus",
    "gastronemius", "hamstring", "tibialis", "plantar", "achilles",
    "femoris", "popliteal", "patella", "sartorius", "vastus", "intrinsic",
    "foot",
  ],
  SHOULDER: [
    "trapezius", "tuberosity", "AC joint", "levator", "rhomboid", "deltoid",
    "bicep", "supraspinatus", "triceps", "infraspinatus", "subscapularis",
    "teres", "pectoralis", "coracobrachialis",
  ],
  NECK: [
    "scalene", "levator", "trapezius", "sternocleidomastoid", "semispinalis",
    "splenius", "suboccipital", "longus",
  ],
  LBP: [
    "iliocostalis", "spinalis", "longissimus", "iliopsoas", "quadratus",
    "gluteal", "multifidus", "erector", "piriformis",
  ],
  ELBOW: [
    "brachioradialis", "extensor", "flexor", "supinator", "pronator",
    "bicep", "triceps", "anconeus", "wrist",
  ],
  HIP: [
    "gluteus", "gluteal", "piriformis", "iliopsoas", "tensor", "adductor",
    "hamstring", "rectus", "sartorius", "quadratus", "obturator",
  ],
};

export const o8: GeneratorRule = {
  id: "O8",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    if (!visit.subjective.bodyPartNormalized) return [];
    const date = visit.assessment.date || "";
    const keywords =
      MUSCLE_KEYWORDS[visit.subjective.bodyPartNormalized.toUpperCase()] || [];
    if (keywords.length === 0) return [];
    const all = [
      ...visit.objective.tightnessMuscles.muscles,
      ...visit.objective.tendernessMuscles.muscles,
      ...visit.objective.spasmMuscles.muscles,
    ];
    const out = [];
    for (const muscle of all) {
      const matches = keywords.some((k) =>
        muscle.toLowerCase().includes(k.toLowerCase()),
      );
      if (!matches) {
        out.push(
          err({
            ruleId: "O8",
            severity: "HIGH",
            visitDate: date,
            visitIndex,
            section: "O",
            field: "muscles",
            ruleName: "Muscles belong to bodyPart",
            message: "Muscle does not belong to body part",
            expected: keywords.join("/"),
            actual: muscle,
          }),
        );
      }
    }
    return out;
  },
};
