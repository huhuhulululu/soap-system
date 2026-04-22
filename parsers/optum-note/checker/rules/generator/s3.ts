import type { GeneratorRule } from "../../types";
import { err } from "../shared";
import { isAdlConsistentWithBodyPart } from "../../../../../src/shared/adl-mappings";

export const s3: GeneratorRule = {
  id: "S3",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    if (!(visit.subjective.adlImpairment && visit.subjective.bodyPartNormalized))
      return [];
    const date = visit.assessment.date || "";
    const { consistent, keywords } = isAdlConsistentWithBodyPart(
      visit.subjective.bodyPartNormalized,
      visit.subjective.adlImpairment,
    );
    if (keywords.length === 0 || consistent) return [];
    return [
      err({
        ruleId: "S3",
        severity: "MEDIUM",
        visitDate: date,
        visitIndex,
        section: "S",
        field: "adlImpairment",
        ruleName: "ADL activities vs bodyPart",
        message: "ADL description missing relevant activities",
        expected: keywords.slice(0, 6).join("/"),
        actual: "no match",
      }),
    ];
  },
};
