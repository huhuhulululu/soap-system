/**
 * 30 deterministic fixture definitions for regression snapshot testing.
 *
 * Distribution:
 * - 7 TX-supported body parts × 3 visit phases (early/mid/late) = 21 core fixtures
 *   (LBP, SHOULDER, KNEE, NECK, ELBOW, SHOULDER-bilateral, MID_LOW_BACK)
 * - 9 edge cases: max pain, min pain, single visit, unilateral LBP,
 *   high pain + long course, pacemaker, medical history, realistic patch, MIDDLE_BACK
 *
 * Seeds: 100001–100030 (unique per fixture)
 */

import type { BodyPart, Laterality, SeverityLevel } from '../../types'

export interface FixtureDefinition {
  readonly name: string
  readonly bodyPart: BodyPart
  readonly laterality: Laterality
  readonly painCurrent: number
  readonly severityLevel: SeverityLevel
  readonly txCount: number
  readonly seed: number
  readonly medicalHistory?: readonly string[]
  readonly hasPacemaker?: boolean
  readonly hasMetalImplant?: boolean
  readonly associatedSymptom?: 'soreness' | 'weakness' | 'stiffness' | 'heaviness' | 'numbness'
  readonly realisticPatch?: boolean
  readonly localPattern?: string
  readonly systemicPattern?: string
}

function severity(pain: number): SeverityLevel {
  if (pain >= 9) return 'severe'
  if (pain >= 7) return 'moderate to severe'
  if (pain >= 6) return 'moderate'
  if (pain >= 4) return 'mild to moderate'
  return 'mild'
}

export const FIXTURES: readonly FixtureDefinition[] = [
  // ── Core: LBP (1-3) ──
  { name: 'LBP-bilateral-early-3tx',       bodyPart: 'LBP',         laterality: 'bilateral', painCurrent: 8, severityLevel: severity(8), txCount: 3,  seed: 100001 },
  { name: 'LBP-bilateral-mid-10tx',        bodyPart: 'LBP',         laterality: 'bilateral', painCurrent: 8, severityLevel: severity(8), txCount: 10, seed: 100002 },
  { name: 'LBP-bilateral-late-20tx',       bodyPart: 'LBP',         laterality: 'bilateral', painCurrent: 8, severityLevel: severity(8), txCount: 20, seed: 100003 },

  // ── Core: SHOULDER (4-6) ──
  { name: 'SHOULDER-left-early-3tx',       bodyPart: 'SHOULDER',     laterality: 'left',      painCurrent: 7, severityLevel: severity(7), txCount: 3,  seed: 100004 },
  { name: 'SHOULDER-left-mid-12tx',        bodyPart: 'SHOULDER',     laterality: 'left',      painCurrent: 7, severityLevel: severity(7), txCount: 12, seed: 100005 },
  { name: 'SHOULDER-left-late-20tx',       bodyPart: 'SHOULDER',     laterality: 'left',      painCurrent: 7, severityLevel: severity(7), txCount: 20, seed: 100006 },

  // ── Core: KNEE (7-9) ──
  { name: 'KNEE-right-early-3tx',          bodyPart: 'KNEE',         laterality: 'right',     painCurrent: 9, severityLevel: severity(9), txCount: 3,  seed: 100007 },
  { name: 'KNEE-right-mid-10tx',           bodyPart: 'KNEE',         laterality: 'right',     painCurrent: 9, severityLevel: severity(9), txCount: 10, seed: 100008 },
  { name: 'KNEE-right-late-18tx',          bodyPart: 'KNEE',         laterality: 'right',     painCurrent: 9, severityLevel: severity(9), txCount: 18, seed: 100009 },

  // ── Core: NECK (10-12) ──
  { name: 'NECK-bilateral-early-3tx',      bodyPart: 'NECK',         laterality: 'bilateral', painCurrent: 6, severityLevel: severity(6), txCount: 3,  seed: 100010 },
  { name: 'NECK-bilateral-mid-8tx',        bodyPart: 'NECK',         laterality: 'bilateral', painCurrent: 6, severityLevel: severity(6), txCount: 8,  seed: 100011 },
  { name: 'NECK-bilateral-late-20tx',      bodyPart: 'NECK',         laterality: 'bilateral', painCurrent: 6, severityLevel: severity(6), txCount: 20, seed: 100012 },

  // ── Core: ELBOW (13-15) ──
  { name: 'ELBOW-left-early-3tx',          bodyPart: 'ELBOW',        laterality: 'left',      painCurrent: 5, severityLevel: severity(5), txCount: 3,  seed: 100013 },
  { name: 'ELBOW-left-mid-10tx',           bodyPart: 'ELBOW',        laterality: 'left',      painCurrent: 5, severityLevel: severity(5), txCount: 10, seed: 100014 },
  { name: 'ELBOW-left-late-20tx',          bodyPart: 'ELBOW',        laterality: 'left',      painCurrent: 5, severityLevel: severity(5), txCount: 20, seed: 100015 },

  // ── Core: SHOULDER-bilateral (16-18) — different laterality/pain from core SHOULDER ──
  { name: 'SHOULDER-bilateral-early-3tx',   bodyPart: 'SHOULDER',     laterality: 'bilateral', painCurrent: 8, severityLevel: severity(8), txCount: 3,  seed: 100016 },
  { name: 'SHOULDER-bilateral-mid-12tx',    bodyPart: 'SHOULDER',     laterality: 'bilateral', painCurrent: 8, severityLevel: severity(8), txCount: 12, seed: 100017 },
  { name: 'SHOULDER-bilateral-late-18tx',   bodyPart: 'SHOULDER',     laterality: 'bilateral', painCurrent: 8, severityLevel: severity(8), txCount: 18, seed: 100018 },

  // ── Core: MID_LOW_BACK (19-21) ──
  { name: 'MID_LOW_BACK-bilateral-early-3tx',  bodyPart: 'MID_LOW_BACK', laterality: 'bilateral', painCurrent: 7, severityLevel: severity(7), txCount: 3,  seed: 100019 },
  { name: 'MID_LOW_BACK-bilateral-mid-10tx',   bodyPart: 'MID_LOW_BACK', laterality: 'bilateral', painCurrent: 7, severityLevel: severity(7), txCount: 10, seed: 100020 },
  { name: 'MID_LOW_BACK-bilateral-late-20tx',  bodyPart: 'MID_LOW_BACK', laterality: 'bilateral', painCurrent: 7, severityLevel: severity(7), txCount: 20, seed: 100021 },

  // ── Edge cases (22-30) ──
  { name: 'LBP-bilateral-maxpain-12tx',    bodyPart: 'LBP',         laterality: 'bilateral', painCurrent: 10, severityLevel: severity(10), txCount: 12, seed: 100022 },
  { name: 'SHOULDER-bilateral-minpain-12tx', bodyPart: 'SHOULDER',   laterality: 'bilateral', painCurrent: 3,  severityLevel: severity(3),  txCount: 12, seed: 100023 },
  { name: 'KNEE-bilateral-single-1tx',     bodyPart: 'KNEE',         laterality: 'bilateral', painCurrent: 8,  severityLevel: severity(8),  txCount: 1,  seed: 100024 },
  { name: 'LBP-left-unilateral-20tx',      bodyPart: 'LBP',         laterality: 'left',      painCurrent: 8,  severityLevel: severity(8),  txCount: 20, seed: 100025 },
  { name: 'SHOULDER-right-highpain-long-20tx', bodyPart: 'SHOULDER', laterality: 'right',     painCurrent: 9,  severityLevel: severity(9),  txCount: 20, seed: 100026 },
  { name: 'NECK-bilateral-pacemaker-12tx', bodyPart: 'NECK',         laterality: 'bilateral', painCurrent: 8,  severityLevel: severity(8),  txCount: 12, seed: 100027, hasPacemaker: true, medicalHistory: ['Pacemaker'] },
  { name: 'LBP-bilateral-medhx-DM-HTN-12tx', bodyPart: 'LBP',      laterality: 'bilateral', painCurrent: 7,  severityLevel: severity(7),  txCount: 12, seed: 100028, medicalHistory: ['Diabetes', 'Hypertension'] },
  { name: 'KNEE-left-realisticpatch-12tx', bodyPart: 'KNEE',         laterality: 'left',      painCurrent: 8,  severityLevel: severity(8),  txCount: 12, seed: 100029, realisticPatch: true },
  { name: 'MIDDLE_BACK-bilateral-mid-12tx', bodyPart: 'MIDDLE_BACK', laterality: 'bilateral', painCurrent: 6,  severityLevel: severity(6),  txCount: 12, seed: 100030 },
] as const
