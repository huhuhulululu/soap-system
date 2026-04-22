import type { CodeRule } from "../../types";
import { err } from "../shared";
import { LATERALITY_ICD_SUFFIX } from "./_tables";

export const dx04: CodeRule = {
  id: "DX04",
  kind: "CODE",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const dx = visit.diagnosisCodes;
    if (dx.length === 0) return [];
    const lat = visit.subjective.laterality || "unspecified";
    const expected = LATERALITY_ICD_SUFFIX[lat];
    if (!expected) return [];
    const out = [];
    for (const d of dx) {
      const lastChar = d.icd10.slice(-1);
      if (/\d/.test(lastChar) && !expected.includes(lastChar)) {
        out.push(
          err({
            ruleId: "DX04",
            severity: "CRITICAL",
            visitDate: date,
            visitIndex,
            section: "A",
            field: "diagnosisCodes",
            ruleName: "ICD laterality 一致",
            message: `ICD ${d.icd10} laterality 与 ${lat} 不一致`,
            expected: `suffix ${expected.join("/")}`,
            actual: lastChar,
          }),
        );
      }
    }
    return out;
  },
};
