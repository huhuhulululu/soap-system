import type { VisitRecord } from "../../types";
import type { CheckError } from "../types";
import { parseStrengthScore } from "../../../../src/shared/field-parsers";

export function err(params: Omit<CheckError, "id">): CheckError {
  return {
    id: `${params.ruleId}-${params.visitIndex}-${params.field}`,
    ...params,
  };
}

export function avgRom(visit: VisitRecord): number {
  if (!visit.objective.rom.items.length) return 0;
  const sum = visit.objective.rom.items.reduce(
    (s, x) => s + (x.degrees || 0),
    0,
  );
  return sum / visit.objective.rom.items.length;
}

export function avgStrength(visit: VisitRecord): number {
  if (!visit.objective.rom.items.length) return 0;
  const sum = visit.objective.rom.items.reduce(
    (s, x) => s + parseStrengthScore(x.strength),
    0,
  );
  return sum / visit.objective.rom.items.length;
}

export function avgRomSeverityRank(visit: VisitRecord): number {
  const rank: Record<string, number> = {
    severe: 0,
    moderate: 1,
    mild: 2,
    normal: 3,
  };
  if (!visit.objective.rom.items.length) return 0;
  const total = visit.objective.rom.items.reduce(
    (s, x) => s + (rank[(x.severity || "").toLowerCase()] ?? 1),
    0,
  );
  return total / visit.objective.rom.items.length;
}

export function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a.map((x) => x.toLowerCase()));
  const sb = new Set(b.map((x) => x.toLowerCase()));
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const uni = new Set([...sa, ...sb]).size;
  return uni === 0 ? 1 : inter / uni;
}

export function trend(cur: number, prev: number): "↓" | "→" | "↑" {
  if (cur < prev) return "↓";
  if (cur > prev) return "↑";
  return "→";
}
