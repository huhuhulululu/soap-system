import type { IERule } from "../../types";
import { err, avgRomSeverityRank } from "../shared";
import { extractPainCurrent } from "../../../../../src/shared/field-parsers";

export const ie03: IERule = {
  id: "IE03",
  kind: "IE",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const pain = extractPainCurrent(visit.subjective.painScale);
    const romRank = avgRomSeverityRank(visit);
    if (!(pain >= 7 && romRank > 2.4)) return [];
    return [
      err({
        ruleId: "IE03",
        severity: "MEDIUM",
        visitDate: date,
        visitIndex,
        section: "O",
        field: "rom",
        ruleName: "pain→ROM limitation 合理",
        message: "高疼痛下 ROM 受限程度过轻",
        expected: "mild/moderate limitation",
        actual: "mostly normal",
      }),
    ];
  },
};
