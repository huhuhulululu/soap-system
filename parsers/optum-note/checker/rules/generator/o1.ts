import type { GeneratorRule } from "../../types";
import { err } from "../shared";
import { extractPainCurrent } from "../../../../../src/shared/field-parsers";
import { findNormal } from "./_rom";

export const o1: GeneratorRule = {
  id: "O1",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const pain = extractPainCurrent(visit.subjective.painScale);
    const limitFactor =
      pain >= 8 ? 0.77 : pain >= 6 ? 0.85 : pain >= 3 ? 0.95 : 1.0;
    const bodyPart = (visit.subjective.bodyPartNormalized || "").toLowerCase();
    const out = [];
    for (const rom of visit.objective.rom.items) {
      const normal = findNormal(rom.movement, bodyPart);
      if (normal <= 0) continue;
      const expected = normal * limitFactor;
      if (rom.degrees > expected * 1.4 || rom.degrees < expected * 0.4) {
        out.push(
          err({
            ruleId: "O1",
            severity: "HIGH",
            visitDate: date,
            visitIndex,
            section: "O",
            field: "rom.degrees",
            ruleName: "ROM degrees vs pain",
            message: "ROM degrees inconsistent with pain level",
            expected: `${expected.toFixed(0)}±25%`,
            actual: String(rom.degrees),
          }),
        );
      }
    }
    return out;
  },
};
