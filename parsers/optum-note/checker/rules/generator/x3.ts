import type { GeneratorRule } from "../../types";
import { err } from "../shared";

const PATTERN_TONGUE: Record<string, string[]> = {
  "Blood Stasis": ["purple", "dark", "dusk"],
  "Qi Stagnation": [
    "thin white",
    "white coat",
    "white coating",
    "purplish",
    "dusk",
  ],
  "Liver Qi": [
    "thin white",
    "white coat",
    "white coating",
    "purplish",
    "dusk",
  ],
  "Cold-Damp": ["white", "thick white", "greasy", "slippery"],
  "Wind-Cold": ["white", "thin white"],
  "Damp-Heat": ["yellow", "greasy", "sticky", "red"],
  "Qi & Blood Deficiency": ["pale", "thin white", "thin dry", "tooth marks"],
  "Blood Deficiency": ["pale", "thin dry"],
  "Kidney Yang": [
    "pale",
    "thin white",
    "white coat",
    "white coating",
    "delicate",
    "swollen",
  ],
  "Kidney Yin": [
    "red",
    "thin",
    "cracked",
    "rootless",
    "moisture",
    "furless",
    "little coat",
  ],
  "Kidney Qi": ["pale", "thin white", "tooth marks"],
  "Kidney Essence": ["cracked", "rootless", "red", "moisture"],
  Phlegm: ["sticky", "greasy", "thick", "big tongue", "white sticky"],
  "Qi Deficiency": ["pale", "thin white", "tooth marks"],
  "Liver Yang": ["red", "thin yellow", "yellow", "white"],
  "Spleen Deficiency": [
    "pale",
    "thin white",
    "tooth-marked",
    "tooth marks",
  ],
};

export const x3: GeneratorRule = {
  id: "X3",
  kind: "GENERATOR",
  check: ({ visit, visitIndex }) => {
    const isIE = visit.subjective.visitType === "INITIAL EVALUATION";
    if (!isIE) return [];
    if (!(visit.assessment.localPattern || visit.assessment.systemicPattern))
      return [];
    const date = visit.assessment.date || "";
    const patterns = [
      visit.assessment.localPattern,
      visit.assessment.systemicPattern,
    ].filter(Boolean) as string[];
    const tongue = visit.objective.tonguePulse.tongue.toLowerCase();
    let anyPatternMatched = false;
    for (const pattern of patterns) {
      const expectedTongues = Object.entries(PATTERN_TONGUE).find(([key]) =>
        pattern.includes(key),
      )?.[1];
      if (expectedTongues && expectedTongues.some((t) => tongue.includes(t))) {
        anyPatternMatched = true;
        break;
      }
      if (!expectedTongues) anyPatternMatched = true;
    }
    if (anyPatternMatched || patterns.length === 0) return [];
    const allExpected = patterns.flatMap((p) => {
      const e = Object.entries(PATTERN_TONGUE).find(([key]) =>
        p.includes(key),
      )?.[1];
      return e || [];
    });
    if (allExpected.length === 0) return [];
    return [
      err({
        ruleId: "X3",
        severity: "CRITICAL",
        visitDate: date,
        visitIndex,
        section: "O",
        field: "tonguePulse",
        ruleName: "Pattern→Tongue/Pulse chain",
        message: "Tongue inconsistent with pattern",
        expected: allExpected.join("/"),
        actual: visit.objective.tonguePulse.tongue,
      }),
    ];
  },
};
