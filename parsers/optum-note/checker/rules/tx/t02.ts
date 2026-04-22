import type { TXRule } from "../../types";
import { err } from "../shared";
import {
  compareSeverity,
  extractPainCurrent,
} from "../../../../../src/shared/field-parsers";

export const t02: TXRule = {
  id: "T02",
  kind: "TX",
  check: ({ visit, visitIndex, prevVisit }) => {
    if (!prevVisit) return [];
    const prevIsIE = prevVisit.subjective.visitType === "INITIAL EVALUATION";
    if (prevIsIE) return [];
    const date = visit.assessment.date || "";
    const saysImprove = /improvement/i.test(
      visit.assessment.symptomChange || "",
    );
    if (!saysImprove) return [];

    const pain = extractPainCurrent(visit.subjective.painScale);
    const prevPain = extractPainCurrent(prevVisit.subjective.painScale);
    const prevTenderness = prevVisit.objective.tendernessMuscles.scale;
    const prevTightness = prevVisit.objective.tightnessMuscles.gradingScale;
    const curTenderness = visit.objective.tendernessMuscles.scale;
    const curTightness = visit.objective.tightnessMuscles.gradingScale;

    const painWorsened = pain > prevPain;
    const tendernessWorsened = curTenderness > prevTenderness;
    const tightnessWorsened = compareSeverity(curTightness, prevTightness) > 0;

    if (!(painWorsened || tendernessWorsened || tightnessWorsened)) return [];

    const indicators: string[] = [];
    if (painWorsened) indicators.push(`pain: ${prevPain}→${pain}`);
    if (tendernessWorsened)
      indicators.push(`tenderness: +${prevTenderness}→+${curTenderness}`);
    if (tightnessWorsened)
      indicators.push(`tightness: ${prevTightness}→${curTightness}`);

    return [
      err({
        ruleId: "T02",
        severity: "CRITICAL",
        visitDate: date,
        visitIndex,
        section: "A",
        field: "symptomChange",
        ruleName: "改善描述与数值变化一致",
        message: "标注 improvement 但数值实际恶化",
        expected: "pain/tenderness/tightness 不恶化",
        actual: indicators.join(", "),
      }),
    ];
  },
};
