import type { CodeRule } from "../../types";
import { err } from "../shared";
import { ICD_BODY_MAP } from "./_tables";

export const dx01: CodeRule = {
  id: "DX01",
  kind: "CODE",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const dx = visit.diagnosisCodes;
    if (dx.length === 0) return [];
    const bp = (visit.subjective.bodyPartNormalized || "").toUpperCase();
    const allowed = ICD_BODY_MAP[bp] || [];
    if (allowed.length === 0) return [];
    const out = [];
    for (const d of dx) {
      const matches = allowed.some((p) => d.icd10.startsWith(p));
      if (!matches) {
        out.push(
          err({
            ruleId: "DX01",
            severity: "CRITICAL",
            visitDate: date,
            visitIndex,
            section: "A",
            field: "diagnosisCodes",
            ruleName: "ICD→bodyPart 匹配",
            message: `ICD ${d.icd10} 与主诉部位 ${bp} 不匹配`,
            expected: allowed.join("/"),
            actual: d.icd10,
          }),
        );
      }
    }
    return out;
  },
};
