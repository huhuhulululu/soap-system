export const NORMAL_DEGREES: Record<string, Record<string, number>> = {
  knee: { flexion: 130, extension: 0 },
  lbp: { flexion: 90, extension: 30, rotation: 45, "lateral flexion": 30 },
  shoulder: { flexion: 180, extension: 60, abduction: 180, rotation: 90 },
  neck: { flexion: 50, extension: 60, rotation: 80, "lateral flexion": 45 },
};

export function findNormal(
  movementName: string,
  bodyPart: string,
): number {
  const m = movementName.toLowerCase();
  const normals = NORMAL_DEGREES[bodyPart.toLowerCase()] || {};
  if (normals[m] !== undefined) return normals[m];
  if (m.includes("flexion to")) {
    return normals["lateral flexion"] ?? 30;
  }
  const sortedKeys = Object.keys(normals).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of sortedKeys) {
    if (m.includes(key)) return normals[key];
  }
  return m.includes("abduction") ? 180 : 90;
}
