import type { SequenceRule } from "../../types";
import { err } from "../shared";

const SYMPTOM_RANKS: Record<string, number> = {
  soreness: 1,
  stiffness: 2,
  heaviness: 3,
  weakness: 4,
  numbness: 4,
};

function extractAssociatedSymptom(cc: string): string | null {
  const m = cc.match(
    /muscles (weakness|soreness|heaviness|numbness|stiffness)/,
  );
  return m ? m[1] : null;
}

export const t09: SequenceRule = {
  id: "T09",
  kind: "SEQUENCE",
  check: ({ prev, cur, visitIndex }) => {
    const date = cur.assessment.date || "";
    const prevSym = extractAssociatedSymptom(prev.subjective.chiefComplaint);
    const curSym = extractAssociatedSymptom(cur.subjective.chiefComplaint);
    if (!prevSym || !curSym) return [];
    const prevRank = SYMPTOM_RANKS[prevSym] ?? 0;
    const curRank = SYMPTOM_RANKS[curSym] ?? 0;
    if (curRank <= prevRank + 1) return [];
    return [
      err({
        ruleId: "T09",
        severity: "MEDIUM",
        visitDate: date,
        visitIndex,
        section: "S",
        field: "chiefComplaint",
        ruleName: "伴随症状级别单调性",
        message: "伴随症状严重程度不应恶化",
        expected: `<= ${prevSym}(${prevRank})+1`,
        actual: `${curSym}(${curRank})`,
      }),
    ];
  },
};
