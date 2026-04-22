import type { TXRule } from "../../types";
import { err } from "../shared";
import {
  extractProgressReasons,
  parseProgressStatus,
} from "../../../../../src/shared/field-parsers";

export const t06: TXRule = {
  id: "T06",
  kind: "TX",
  check: ({ visit, visitIndex }) => {
    const date = visit.assessment.date || "";
    const status = parseProgressStatus(visit.subjective.chiefComplaint);
    const reasons = extractProgressReasons(visit.subjective.chiefComplaint);
    const out = [];

    if (status === "improvement" && reasons.negative.length > 0) {
      out.push(
        err({
          ruleId: "T06",
          severity: "MEDIUM",
          visitDate: date,
          visitIndex,
          section: "S",
          field: "chiefComplaint",
          ruleName: "进展状态 + 原因逻辑一致",
          message: "progressStatus=improvement 但包含负向原因",
          expected:
            "正向原因 (maintain regular treatments, reduced level of pain, etc.)",
          actual: `负向原因: ${reasons.negative.join(", ")}`,
        }),
      );
    }

    if (status === "exacerbate" && reasons.positive.length > 0) {
      out.push(
        err({
          ruleId: "T06",
          severity: "MEDIUM",
          visitDate: date,
          visitIndex,
          section: "S",
          field: "chiefComplaint",
          ruleName: "进展状态 + 原因逻辑一致",
          message: "progressStatus=exacerbate 但包含正向原因",
          expected:
            "负向原因 (skipped treatments, intense work, bad posture, etc.)",
          actual: `正向原因: ${reasons.positive.join(", ")}`,
        }),
      );
    }

    return out;
  },
};
