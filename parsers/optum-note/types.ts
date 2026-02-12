/**
 * Optum Note PDF Parser Types
 * CC Acupuncture PC SOAP Format Medical Records
 */

// ============ Header Types ============
export interface PatientInfo {
  name: string
  dob: string // MM/DD/YYYY
  patientId: string // 10-digit ID
  gender: 'Male' | 'Female'
  age: number
  ageAsOfDate: string // MM/DD/YYYY
}

export interface DocumentHeader {
  patient: PatientInfo
  dateOfService: string // MM/DD/YYYY (初诊日期)
  printedOn: string // MM/DD/YYYY
}

// ============ Subjective Types ============
export type VisitType = 'INITIAL EVALUATION' | 'Follow up visit'

export type PainType = 'Dull' | 'Aching' | 'Freezing' | 'Shooting' | 'pin & needles' | 'pricking' | 'weighty'

export type PainFrequency = 'Intermittent' | 'Occasional' | 'Frequent' | 'Constant'

export interface PainScale {
  value: number // 单一值
  range?: { min: number; max: number } // 范围值 e.g., 5-4
}

export interface PainScaleDetailed {
  worst: number
  best: number | { min: number; max: number }
  current: number
}

export interface Subjective {
  visitType: VisitType
  chiefComplaint: string
  chronicityLevel: 'Acute' | 'Sub Acute' | 'Chronic'
  painTypes: PainType[]
  bodyPart: string
  bodyPartNormalized?: string
  laterality?: 'left' | 'right' | 'bilateral' | 'unspecified'
  radiation: boolean
  muscleWeaknessScale: string // e.g., "40%", "50%-60%"
  /** @deprecated 使用 adlDifficultyLevel + adlActivities 替代，将在 Phase 5 删除 */
  adlImpairment: string
  adlDifficultyLevel: 'mild' | 'mild to moderate' | 'moderate' | 'moderate to severe' | 'severe'
  /** 具体 ADL 活动列表 (从 adlImpairment 提取) */
  adlActivities?: string[]
  /** 保留原始 ADL 文本用于调试 */
  adlRawText?: string
  painScale: PainScale | PainScaleDetailed
  painFrequency: PainFrequency
  painFrequencyRange: string // e.g., "51% and 75%", "76% and 100%"
  walkingAid?: string // 仅初诊
  medicalHistory?: string[] // 仅初诊
}

// ============ Objective Types ============
export type GradingScale = 'mild' | 'moderate' | 'severe' | 'mild to moderate' | 'moderate to severe'

export interface MuscleTest {
  muscles: string[]
  gradingScale: GradingScale
}

export interface TendernessTest {
  muscles: string[]
  scale: number // +1 to +4
  scaleDescription: string
}

export interface SpasmTest {
  muscles: string[]
  frequencyScale: number // +2 or +3
  scaleDescription: string
}

export interface ROMItem {
  strength: string // e.g., "4-/5", "3+/5", "4/5"
  movement: string // e.g., "Flexion", "Extension"
  degrees: number
  severity: string // e.g., "mild", "moderate", "normal"
}

export interface ROM {
  bodyPart: string // e.g., "Left Knee", "Right Shoulder", "Cervical"
  items: ROMItem[]
}

export type InspectionType =
  | 'local skin no damage or rash'
  | 'weak muscles and dry skin without luster'
  | 'joint swelling'

export interface TonguePulse {
  tongue: string // e.g., "pale, thin white coat", "purple", "yellow, sticky (red), thick coat"
  pulse: string // e.g., "thready", "deep", "rapid", "rolling rapid (forceful)"
}

export interface Objective {
  inspection: InspectionType
  tightnessMuscles: MuscleTest
  tendernessMuscles: TendernessTest
  spasmMuscles: SpasmTest
  rom: ROM
  tonguePulse: TonguePulse
}

// ============ Assessment Types ============
export interface TCMDiagnosis {
  diagnosis: string // e.g., "Right knee pain due to Cold-Damp + Wind-Cold"
  pattern: string // e.g., "Qi & Blood Deficiency", "Kidney Yang Deficiency"
  treatmentPrinciples: string
}

export interface Assessment {
  date: string // MM/DD/YYYY
  generalCondition: 'good' | 'fair' | 'poor'
  symptomChange: 'improvement' | 'slight improvement' | 'no change' | 'exacerbate'
  physicalFindingChange: string
  tcmDiagnosis?: TCMDiagnosis // 仅初诊
  currentPattern: string // e.g., "Qi & Blood Deficiency in local meridian"
  localPattern?: string
  systemicPattern?: string
  /** 进展原因 (正向/负向)，由 Parser 从 chiefComplaint 提取 */
  progressReasons?: { positive: string[]; negative: string[] }
}

// ============ Plan Types ============
export interface NeedleSpec {
  gauge: string // e.g., "36#", "34#", "30#"
  length: string // e.g., "0.5\"", "1\"", "1.5\"", "2\"", "3\""
}

export interface TreatmentGoal {
  frequency: string // e.g., "12 treatments in 5-6 weeks"
  painScaleTarget: string
  sensationScaleTarget: string
  tightnessTarget: string
  tendernessTarget: string
  spasmsTarget: string
  strengthTarget: string
  romTarget?: string
  adlTarget?: string
}

export interface Plan {
  needleSpecs: NeedleSpec[]
  treatmentTime: number // 固定15分钟
  treatmentPosition: 'Front Points' | 'Back Points'
  acupoints: string[]
  electricalStimulation: boolean
  shortTermGoal?: TreatmentGoal // 仅初诊
  longTermGoal?: TreatmentGoal // 仅初诊
  treatmentPrinciples: string
}

// ============ Code Types ============
export interface DiagnosisCode {
  description: string // e.g., "Pain in right knee"
  icd10: string // e.g., "M25.561"
}

export interface ProcedureCode {
  description: string // e.g., "ACUP 1/> WO ESTIM 1ST 15 MIN"
  cpt: string // e.g., "97810"
}

// ============ Visit Record ============
export interface VisitRecord {
  subjective: Subjective
  objective: Objective
  assessment: Assessment
  plan: Plan
  diagnosisCodes: DiagnosisCode[]
  procedureCodes: ProcedureCode[]
}

// ============ Complete Document ============
export interface OptumNoteDocument {
  header: DocumentHeader
  visits: VisitRecord[]
}

// ============ Parser Result ============
export interface ParseResult {
  success: boolean
  document?: OptumNoteDocument
  errors: ParseError[]
  warnings: ParseWarning[]
}

export interface ParseError {
  field: string
  message: string
  line?: number
}

export interface ParseWarning {
  field: string
  message: string
  line?: number
}
