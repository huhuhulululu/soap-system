/** Unified strength grade ladder (index = numeric level) */
export const STRENGTH_LADDER: readonly string[] = [
  "3-/5",
  "3/5",
  "3+/5",
  "4-/5",
  "4/5",
  "4+/5",
  "5/5",
];

/** Pain level → base strength grade (authoritative: from objective-patch) */
export const PATCHED_BASE_GRADES: readonly string[] = [
  "5/5", // pain 0
  "4+/5", // pain 1
  "4+/5", // pain 2
  "4/5", // pain 3
  "4/5", // pain 4
  "4-/5", // pain 5
  "4-/5", // pain 6
  "4-/5", // pain 7
  "3+/5", // pain 8
  "3+/5", // pain 9
  "3/5", // pain 10
];

export function strengthFromPain(painLevel: number): string {
  const painInt = Math.round(Math.max(0, Math.min(10, painLevel)));
  return PATCHED_BASE_GRADES[painInt];
}

export function strengthToIndex(grade: string): number {
  const normalized = grade.includes("/") ? grade : `${grade}/5`;
  const idx = STRENGTH_LADDER.indexOf(normalized);
  if (idx >= 0) return idx;
  const fuzzy = STRENGTH_LADDER.findIndex((s) => s.startsWith(grade));
  return fuzzy >= 0 ? fuzzy : 4;
}
