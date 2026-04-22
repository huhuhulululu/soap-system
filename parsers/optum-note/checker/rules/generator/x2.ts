import type { GeneratorRule } from "../../types";
import { avgRomSeverityRank, err } from "../shared";
import { extractPainCurrent } from "../../../../../src/shared/field-parsers";

export const x2: GeneratorRule = {
  id: "X2",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const pain = extractPainCurrent(visit.subjective.painScale);
    const avgRomSev = avgRomSeverityRank(visit);
    if (!((pain >= 8 && avgRomSev > 2.5) || (pain <= 3 && avgRomSev < 0.5)))
      return [];
    return [
      err({
        ruleId: "X2",
        severity: "CRITICAL",
        visitDate: date,
        visitIndex,
        section: "O",
        field: "rom",
        ruleName: "Pain→ROM→Strength chain",
        message: "ROM severity inconsistent with pain",
        expected: pain >= 8 ? "not normal" : "not severe",
        actual: avgRomSev > 2.5 ? "mostly normal" : "mostly severe",
      }),
    ];
  },
};
