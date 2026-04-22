import type { TXRule } from "../../types";
import { err } from "../shared";
import { extractPainCurrent } from "../../../../../src/shared/field-parsers";

export const tx03: TXRule = {
  id: "TX03",
  kind: "TX",
  check: ({ visit, visitIndex, prevVisit }) => {
    if (!prevVisit) return [];
    const date = visit.assessment.date || "";
    const pain = extractPainCurrent(visit.subjective.painScale);
    const prevPain = extractPainCurrent(prevVisit.subjective.painScale);
    const delta = pain - prevPain;
    const saysImprove = /improvement/i.test(
      visit.assessment.symptomChange || "",
    );
    if (!(saysImprove && delta > 0)) return [];
    return [
      err({
        ruleId: "TX03",
        severity: "MEDIUM",
        visitDate: date,
        visitIndex,
        section: "A",
        field: "symptomChange",
        ruleName: "symptomChange 描述与 pain delta 一致",
        message: "标注改善但疼痛上升",
        expected: `pain <= ${prevPain}`,
        actual: `${pain}`,
      }),
    ];
  },
};
