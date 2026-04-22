import type { DocRule } from "../../types";
import { err } from "../shared";

export const doc01: DocRule = {
  id: "DOC01",
  kind: "DOC",
  check: ({ visits }) => {
    const ieVisit = visits.find(
      (v) => v.subjective.visitType === "INITIAL EVALUATION",
    );
    if (ieVisit) return [];
    return [
      err({
        ruleId: "DOC01",
        severity: "CRITICAL",
        visitDate: "",
        visitIndex: 0,
        section: "S",
        field: "visitType",
        ruleName: "缺少初诊记录",
        message: "文档中未发现 IE 记录",
        expected: "at least one IE",
        actual: "none",
      }),
    ];
  },
};
