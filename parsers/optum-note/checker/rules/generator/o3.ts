import type { GeneratorRule } from "../../types";
import { err } from "../shared";
import { parseStrengthScore } from "../../../../../src/shared/field-parsers";

export const o3: GeneratorRule = {
  id: "O3",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const out = [];
    for (const rom of visit.objective.rom.items) {
      const strength = parseStrengthScore(rom.strength);
      const severity = rom.severity?.toLowerCase();
      if (
        (severity === "severe" && strength > 4) ||
        (severity === "normal" && strength < 4)
      ) {
        out.push(
          err({
            ruleId: "O3",
            severity: "HIGH",
            visitDate: date,
            visitIndex,
            section: "O",
            field: "rom.strength",
            ruleName: "Strength vs ROM limitation",
            message: "Strength inconsistent with ROM severity",
            expected: severity === "severe" ? "<=4" : ">=4",
            actual: String(strength),
          }),
        );
      }
    }
    return out;
  },
};
