import type { TXRule } from "../../types";
import { err } from "../shared";
import {
  compareSeverity,
  extractPainCurrent,
} from "../../../../../src/shared/field-parsers";

export const t03: TXRule = {
  id: "T03",
  kind: "TX",
  check: ({ visit, visitIndex, prevVisit }) => {
    if (!prevVisit) return [];
    const date = visit.assessment.date || "";
    const saysExacerbate = /exacerbate/i.test(
      visit.assessment.symptomChange || "",
    );
    if (!saysExacerbate) return [];

    const pain = extractPainCurrent(visit.subjective.painScale);
    const prevPain = extractPainCurrent(prevVisit.subjective.painScale);
    const prevTenderness = prevVisit.objective.tendernessMuscles.scale;
    const prevTightness = prevVisit.objective.tightnessMuscles.gradingScale;
    const curTenderness = visit.objective.tendernessMuscles.scale;
    const curTightness = visit.objective.tightnessMuscles.gradingScale;

    const painImproved = pain < prevPain;
    const tendernessImproved = curTenderness < prevTenderness;
    const tightnessImproved = compareSeverity(curTightness, prevTightness) < 0;

    if (!(painImproved || tendernessImproved || tightnessImproved)) return [];

    const indicators: string[] = [];
    if (painImproved) indicators.push(`pain: ${prevPain}→${pain}`);
    if (tendernessImproved)
      indicators.push(`tenderness: +${prevTenderness}→+${curTenderness}`);
    if (tightnessImproved)
      indicators.push(`tightness: ${prevTightness}→${curTightness}`);

    return [
      err({
        ruleId: "T03",
        severity: "CRITICAL",
        visitDate: date,
        visitIndex,
        section: "A",
        field: "symptomChange",
        ruleName: "恶化描述与数值变化一致",
        message: "标注 exacerbate 但数值实际改善",
        expected: "pain/tenderness/tightness 不改善",
        actual: indicators.join(", "),
      }),
    ];
  },
};
