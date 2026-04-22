import type { TXRule } from "../../types";
import { err } from "../shared";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function extractKeywords(s: string): string[] {
  return norm(s)
    .split(/[,;/\s]+/)
    .filter((w) => w.length > 2);
}

function keywordMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na.includes(nb) || nb.includes(na)) return true;
  const ka = extractKeywords(a);
  const kb = extractKeywords(b);
  return ka.some((w) => nb.includes(w)) || kb.some((w) => na.includes(w));
}

export const tx05: TXRule = {
  id: "TX05",
  kind: "TX",
  check: ({ visit, visitIndex, ieVisit }) => {
    if (!ieVisit) return [];
    const date = visit.assessment.date || "";
    const ieTongue = ieVisit.objective.tonguePulse.tongue;
    const iePulse = ieVisit.objective.tonguePulse.pulse;
    const tongueMatch = keywordMatch(
      visit.objective.tonguePulse.tongue,
      ieTongue,
    );
    const pulseMatch = keywordMatch(visit.objective.tonguePulse.pulse, iePulse);
    if (tongueMatch && pulseMatch) return [];
    return [
      err({
        ruleId: "TX05",
        severity: "HIGH",
        visitDate: date,
        visitIndex,
        section: "O",
        field: "tonguePulse",
        ruleName: "舌脉→证型一致",
        message: "TX 舌脉与 IE 基线不一致",
        expected: `${ieTongue} / ${iePulse}`,
        actual: `${visit.objective.tonguePulse.tongue} / ${visit.objective.tonguePulse.pulse}`,
      }),
    ];
  },
};
