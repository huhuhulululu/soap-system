import type { TXRule } from "../../types";
import { err } from "../shared";

export const tx04: TXRule = {
  id: "TX04",
  kind: "TX",
  check: ({ visit, visitIndex, prevVisit }) => {
    if (!prevVisit) return [];
    const date = visit.assessment.date || "";
    const prevGc = (prevVisit.assessment.generalCondition || "").toLowerCase();
    const curGc = (visit.assessment.generalCondition || "").toLowerCase();
    if (!(prevGc === "good" && curGc === "poor")) return [];
    return [
      err({
        ruleId: "TX04",
        severity: "MEDIUM",
        visitDate: date,
        visitIndex,
        section: "A",
        field: "generalCondition",
        ruleName: "generalCondition 合理",
        message: "generalCondition 跨 visit 变化过大",
        expected: "stable or mild drift",
        actual: `${prevGc} -> ${curGc}`,
      }),
    ];
  },
};
