/**
 * Shared severity utility functions
 * Used by both note-checker.ts and correction-generator.ts
 */

export type SeverityLevel = 'mild' | 'mild to moderate' | 'moderate' | 'moderate to severe' | 'severe'

/**
 * Maps pain level to severity description
 * @param pain - Pain scale value (0-10)
 * @returns Severity level string
 */
export function severityFromPain(pain: number): SeverityLevel {
  if (pain >= 9) return 'severe'
  if (pain >= 7) return 'moderate to severe'
  if (pain >= 6) return 'moderate'
  if (pain >= 4) return 'mild to moderate'
  return 'mild'
}

/**
 * Maps pain level to minimum expected tenderness scale
 * @param pain - Pain scale value (0-10)
 * @returns Minimum tenderness scale (+1 to +4)
 */
export function expectedTenderMinScaleByPain(pain: number): number {
  if (pain >= 7) return 3
  if (pain >= 5) return 2
  return 1
}
