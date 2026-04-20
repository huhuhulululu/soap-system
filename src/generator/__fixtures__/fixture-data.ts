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

import type { BodyPart, InsuranceType, Laterality, NoteType, SeverityLevel } from '../../types'
import { severityFromPain } from '../../shared/severity'

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
  // ── v2 extensions (W1.3 roadmap — coverage blind spots) ──
  readonly insuranceType?: InsuranceType            // default 'OPTUM'
  readonly chronicityLevel?: 'Acute' | 'Sub Acute' | 'Chronic'  // default 'Chronic'
  readonly age?: number
  readonly gender?: 'Male' | 'Female'
  readonly disableChronicCaps?: boolean             // default false
  readonly startVisitIndex?: number                 // for continue-mode
  readonly initialFrequency?: number                // 0-3; default 3
  readonly allowNegativeEvents?: boolean            // default false
  // ── v3 extensions (W1.3 roadmap — IE/RE + multi-bodypart) ──
  readonly noteType?: NoteType                      // default 'TX'; IE/RE go through exportSOAP directly
  readonly secondaryBodyParts?: readonly BodyPart[] // multi-bodypart coverage
}

// severity(pain) moved to src/shared/severity.ts::severityFromPain
const severity = severityFromPain

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

  // ── v2 coverage extensions (W1.3) — new fixtures 31-42 ──
  // Insurance variants (31-35): non-OPTUM branches never before snapshotted
  { name: 'LBP-HF-bilateral-mid-10tx',      bodyPart: 'LBP',      laterality: 'bilateral', painCurrent: 7, severityLevel: severity(7), txCount: 10, seed: 100031, insuranceType: 'HF' },
  { name: 'SHOULDER-WC-left-mid-12tx',      bodyPart: 'SHOULDER', laterality: 'left',      painCurrent: 8, severityLevel: severity(8), txCount: 12, seed: 100032, insuranceType: 'WC' },
  { name: 'KNEE-VC-right-early-6tx',        bodyPart: 'KNEE',     laterality: 'right',     painCurrent: 7, severityLevel: severity(7), txCount: 6,  seed: 100033, insuranceType: 'VC' },
  { name: 'NECK-ELDERPLAN-bilateral-10tx',  bodyPart: 'NECK',     laterality: 'bilateral', painCurrent: 6, severityLevel: severity(6), txCount: 10, seed: 100034, insuranceType: 'ELDERPLAN', age: 72 },
  { name: 'ELBOW-NONE-left-8tx',            bodyPart: 'ELBOW',    laterality: 'left',      painCurrent: 5, severityLevel: severity(5), txCount: 8,  seed: 100035, insuranceType: 'NONE' },

  // Chronicity variants (36-37): Acute & Sub Acute branches
  { name: 'LBP-Acute-bilateral-6tx',        bodyPart: 'LBP',      laterality: 'bilateral', painCurrent: 7, severityLevel: severity(7), txCount: 6,  seed: 100036, chronicityLevel: 'Acute' },
  { name: 'KNEE-SubAcute-right-10tx',       bodyPart: 'KNEE',     laterality: 'right',     painCurrent: 8, severityLevel: severity(8), txCount: 10, seed: 100037, chronicityLevel: 'Sub Acute' },

  // Demographics (38-39): age/gender drive ADL filtering + progressMultiplier
  { name: 'SHOULDER-young-female-20yo-8tx', bodyPart: 'SHOULDER', laterality: 'right',     painCurrent: 7, severityLevel: severity(7), txCount: 8,  seed: 100038, age: 20, gender: 'Female' },
  { name: 'LBP-elderly-male-78yo-12tx',     bodyPart: 'LBP',      laterality: 'bilateral', painCurrent: 8, severityLevel: severity(8), txCount: 12, seed: 100039, age: 78, gender: 'Male', medicalHistory: ['Diabetes', 'Osteoporosis'] },

  // Continue mode (40): startVisitIndex > 1 — never before snapshotted
  { name: 'NECK-continue-from-tx4-10tx',    bodyPart: 'NECK',     laterality: 'bilateral', painCurrent: 5, severityLevel: severity(5), txCount: 10, seed: 100040, startVisitIndex: 4, initialFrequency: 2 },

  // disableChronicCaps (41): bypass chronic dampener
  { name: 'LBP-no-chronic-caps-12tx',       bodyPart: 'LBP',      laterality: 'bilateral', painCurrent: 8, severityLevel: severity(8), txCount: 12, seed: 100041, disableChronicCaps: true },

  // Negative events allowed (42): exacerbate/came-back branch
  { name: 'SHOULDER-negative-events-18tx',  bodyPart: 'SHOULDER', laterality: 'left',      painCurrent: 7, severityLevel: severity(7), txCount: 18, seed: 100042, allowNegativeEvents: true },

  // ── v3 extensions (43-55): IE/RE + multi-bodypart + assocSymptom variety + demographics ──

  // IE fixtures (43-44): noteType='IE' → exportSOAP single-pass; txCount=1 placeholder
  { name: 'LBP-IE-new-patient',            bodyPart: 'LBP',      laterality: 'bilateral', painCurrent: 8, severityLevel: severity(8), txCount: 1,  seed: 100043, noteType: 'IE' },
  { name: 'KNEE-IE-existing-patient',      bodyPart: 'KNEE',     laterality: 'right',     painCurrent: 7, severityLevel: severity(7), txCount: 1,  seed: 100044, noteType: 'IE' },

  // RE fixtures (45-46): noteType='RE' → same branch but RE-EVALUATION header
  { name: 'SHOULDER-RE-midcourse',         bodyPart: 'SHOULDER', laterality: 'left',      painCurrent: 6, severityLevel: severity(6), txCount: 1,  seed: 100045, noteType: 'RE' },
  { name: 'NECK-RE-latecourse',            bodyPart: 'NECK',     laterality: 'bilateral', painCurrent: 5, severityLevel: severity(5), txCount: 1,  seed: 100046, noteType: 'RE' },

  // Multi-bodypart fixtures (47-48): secondaryBodyParts non-empty
  { name: 'LBP+NECK-bilateral-mid-10tx',   bodyPart: 'LBP',      laterality: 'bilateral', painCurrent: 7, severityLevel: severity(7), txCount: 10, seed: 100047, secondaryBodyParts: ['NECK'] },
  { name: 'SHOULDER+ELBOW-left-mid-12tx',  bodyPart: 'SHOULDER', laterality: 'left',      painCurrent: 7, severityLevel: severity(7), txCount: 12, seed: 100048, secondaryBodyParts: ['ELBOW'] },

  // continue-mode distinct from tx4 (49): startVisitIndex=8
  { name: 'LBP-continue-from-tx8-10tx',    bodyPart: 'LBP',      laterality: 'bilateral', painCurrent: 5, severityLevel: severity(5), txCount: 10, seed: 100049, startVisitIndex: 8, initialFrequency: 1 },

  // associatedSymptom variety (50-53): weakness / stiffness / heaviness / numbness
  { name: 'KNEE-weakness-right-10tx',      bodyPart: 'KNEE',     laterality: 'right',     painCurrent: 6, severityLevel: severity(6), txCount: 10, seed: 100050, associatedSymptom: 'weakness' },
  { name: 'NECK-stiffness-bilateral-10tx', bodyPart: 'NECK',     laterality: 'bilateral', painCurrent: 6, severityLevel: severity(6), txCount: 10, seed: 100051, associatedSymptom: 'stiffness' },
  { name: 'LBP-heaviness-bilateral-10tx',  bodyPart: 'LBP',      laterality: 'bilateral', painCurrent: 6, severityLevel: severity(6), txCount: 10, seed: 100052, associatedSymptom: 'heaviness' },
  { name: 'SHOULDER-numbness-left-10tx',   bodyPart: 'SHOULDER', laterality: 'left',      painCurrent: 6, severityLevel: severity(6), txCount: 10, seed: 100053, associatedSymptom: 'numbness' },

  // demographics (54-55): age<30 female + age 50-65 male
  { name: 'SHOULDER-young-female-25yo-8tx', bodyPart: 'SHOULDER', laterality: 'right',    painCurrent: 7, severityLevel: severity(7), txCount: 8,  seed: 100054, age: 25, gender: 'Female' },
  { name: 'LBP-middle-male-55yo-12tx',      bodyPart: 'LBP',      laterality: 'bilateral', painCurrent: 8, severityLevel: severity(8), txCount: 12, seed: 100055, age: 55, gender: 'Male' },
] as const
