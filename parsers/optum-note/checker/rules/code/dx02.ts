import type { CodeRule } from "../../types";
import { err } from "../shared";

export const dx02: CodeRule = {
  id: "DX02",
  kind: "CODE",
  check: ({ visits, visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    if (visitIndex === 0) return [];
    const prevVisit = visits[visitIndex - 1];
    const curDxCodes = visit.diagnosisCodes.map((d) => d.icd10).sort();
    const prevDxCodes = prevVisit.diagnosisCodes.map((d) => d.icd10).sort();
    if (prevDxCodes.length === 0 || curDxCodes.length === 0) return [];
    const overlap = curDxCodes.filter((c) => prevDxCodes.includes(c)).length;
    const total = new Set([...curDxCodes, ...prevDxCodes]).size;
    if (total === 0 || overlap / total >= 0.5) return [];
    return [
      err({
        ruleId: "DX02",
        severity: "CRITICAL",
        visitDate: date,
        visitIndex,
        section: "A",
        field: "diagnosisCodes",
        ruleName: "ICD 跨 visit 一致",
        message: "ICD 编码与上次就诊差异过大",
        expected: "overlap >= 50%",
        actual: `${Math.round((overlap / total) * 100)}%`,
      }),
    ];
  },
};
