import type { GeneratorRule } from "../../types";
import { err } from "../shared";

const VALID_GAUGES: Record<string, number[]> = {
  KNEE: [30, 34],
  SHOULDER: [30, 34, 36],
  NECK: [30, 34, 36],
  LBP: [30, 34],
};

export const p1: GeneratorRule = {
  id: "P1",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    if (!visit.subjective.bodyPartNormalized) return [];
    const date = visit.assessment.date || "";
    const valid =
      VALID_GAUGES[visit.subjective.bodyPartNormalized.toUpperCase()] || [];
    if (valid.length === 0) return [];
    const out = [];
    for (const spec of visit.plan.needleSpecs) {
      const gauge = parseInt(spec.gauge.replace("#", ""));
      if (!valid.includes(gauge)) {
        out.push(
          err({
            ruleId: "P1",
            severity: "CRITICAL",
            visitDate: date,
            visitIndex,
            section: "P",
            field: "needleSpecs.gauge",
            ruleName: "Needle gauge vs bodyPart",
            message: "Invalid needle gauge for body part",
            expected: valid.join("/"),
            actual: String(gauge),
          }),
        );
      }
    }
    return out;
  },
};
