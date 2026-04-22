import type { GeneratorRule } from "../../types";
import { err } from "../shared";
import { findNormal } from "./_rom";

export const o2: GeneratorRule = {
  id: "O2",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const bodyPart = (visit.subjective.bodyPartNormalized || "").toLowerCase();
    const out = [];
    for (const rom of visit.objective.rom.items) {
      const normal = findNormal(rom.movement, bodyPart);
      const ratio = rom.degrees / normal;
      const severity = rom.severity?.toLowerCase();
      if (
        (severity === "normal" && ratio < 0.85) ||
        (severity === "severe" && ratio > 0.55) ||
        (severity === "mild" && (ratio < 0.5 || ratio > 0.95))
      ) {
        out.push(
          err({
            ruleId: "O2",
            severity: "HIGH",
            visitDate: date,
            visitIndex,
            section: "O",
            field: "rom.severity",
            ruleName: "ROM limitation label vs degrees",
            message: "ROM severity label inconsistent with degrees",
            expected: "consistent label",
            actual: `${severity} at ${(ratio * 100).toFixed(0)}%`,
          }),
        );
      }
    }
    return out;
  },
};
