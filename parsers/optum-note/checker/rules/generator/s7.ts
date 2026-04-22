import type { GeneratorRule } from "../../types";
import { err } from "../shared";
import { extractPainCurrent } from "../../../../../src/shared/field-parsers";

function parsePercent(scale: string): number {
  const match = scale.match(/(\d+)(?:%|-(\d+)%)?/);
  if (!match) return 0;
  return match[2]
    ? (parseInt(match[1]) + parseInt(match[2])) / 2
    : parseInt(match[1]);
}

export const s7: GeneratorRule = {
  id: "S7",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    if (!visit.subjective.muscleWeaknessScale) return [];
    const date = visit.assessment.date || "";
    const pain = extractPainCurrent(visit.subjective.painScale);
    const weakness = parsePercent(visit.subjective.muscleWeaknessScale);
    if (!((pain >= 7 && weakness < 40) || (pain >= 5 && weakness < 20)))
      return [];
    return [
      err({
        ruleId: "S7",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "S",
        field: "muscleWeaknessScale",
        ruleName: "muscleWeaknessScale vs pain",
        message: "Muscle weakness scale too low for pain level",
        expected: pain >= 7 ? ">=40%" : ">=20%",
        actual: `${weakness}%`,
      }),
    ];
  },
};
