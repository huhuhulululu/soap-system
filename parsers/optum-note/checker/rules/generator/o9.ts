import type { GeneratorRule } from "../../types";
import { err } from "../shared";

const VALID_MOVEMENTS: Record<string, string[]> = {
  KNEE: ["flexion", "extension"],
  SHOULDER: ["abduction", "adduction", "flexion", "extension", "rotation"],
  NECK: ["flexion", "extension", "rotation"],
  LBP: ["flexion", "extension", "rotation"],
};

export const o9: GeneratorRule = {
  id: "O9",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    if (!visit.subjective.bodyPartNormalized) return [];
    const date = visit.assessment.date || "";
    const valid =
      VALID_MOVEMENTS[visit.subjective.bodyPartNormalized.toUpperCase()] || [];
    if (valid.length === 0) return [];
    const out = [];
    for (const rom of visit.objective.rom.items) {
      const matches = valid.some((m) =>
        rom.movement.toLowerCase().includes(m),
      );
      if (!matches) {
        out.push(
          err({
            ruleId: "O9",
            severity: "CRITICAL",
            visitDate: date,
            visitIndex,
            section: "O",
            field: "rom.movement",
            ruleName: "ROM movement belongs to bodyPart",
            message: "ROM movement invalid for body part",
            expected: valid.join("/"),
            actual: rom.movement,
          }),
        );
      }
    }
    return out;
  },
};
