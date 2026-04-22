import type { SequenceRule } from "../../types";
import { avgRom, err } from "../shared";

export const v05: SequenceRule = {
  id: "V05",
  kind: "SEQUENCE",
  check: ({ prev, cur, visitIndex }) => {
    const date = cur.assessment.date || "";
    const prevRom = avgRom(prev);
    const curRom = avgRom(cur);
    if (curRom >= prevRom - 3) return [];
    return [
      err({
        ruleId: "V05",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "O",
        field: "rom",
        ruleName: "ROM 不下降",
        message: "ROM 平均值下降",
        expected: `>= ${(prevRom - 3).toFixed(1)}`,
        actual: curRom.toFixed(1),
      }),
    ];
  },
};
