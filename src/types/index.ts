/**
 * SOAP 医疗笔记系统 - 核心类型定义
 */

// ==================== 基础枚举 ====================

export type NoteType = 'IE' | 'TX' | 'RE' | 'NEW_IE'

export type InsuranceType = 'NONE' | 'HF' | 'OPTUM' | 'WC' | 'VC' | 'ELDERPLAN'

export type BodyPart =
  | 'LBP' | 'NECK' | 'UPPER_BACK' | 'MIDDLE_BACK' | 'MID_LOW_BACK'
  | 'SHOULDER' | 'ELBOW' | 'WRIST' | 'HAND'
  | 'HIP' | 'KNEE' | 'ANKLE' | 'FOOT'
  | 'THIGH' | 'CALF' | 'ARM' | 'FOREARM'

export type Laterality = 'left' | 'right' | 'bilateral' | 'unspecified'

export type SeverityLevel = 'mild' | 'mild to moderate' | 'moderate' | 'moderate to severe' | 'severe'

export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO'

// ==================== 中医证型 ====================

export type TCMPatternType = 'local' | 'systemic'

export interface TCMPattern {
  name: string
  chineseName: string
  type: TCMPatternType
  tongue: string[]
  tongueChineseName: string
  pulse: string[]
  pulseChineseName: string
  treatmentPrinciples: string[]
  mainSymptoms: string[]
}

// ==================== 下拉框定义 ====================

export type DropdownType = 'single' | 'multi'

export interface DropdownField {
  fieldId: string
  type: DropdownType
  section: 'S' | 'O' | 'A' | 'P'
  context: string
  options: string[]
  defaultValue: string | string[]
  weights?: OptionWeight[]
}

export interface OptionWeight {
  option: string
  baseWeight: number
  conditions: WeightCondition[]
}

export interface WeightCondition {
  field: string
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'in'
  value: string | number | string[]
  weightModifier: number
}

// ==================== SOAP 结构 ====================

export interface SOAPNote {
  header: NoteHeader
  subjective: Subjective
  objective: Objective
  assessment: Assessment
  plan: Plan
  diagnosisCodes: DiagnosisCode[]
  procedureCodes: ProcedureCode[]
}

export interface NoteHeader {
  patientId: string
  visitDate: string
  noteType: NoteType
  insuranceType: InsuranceType
  visitNumber?: number
}

export interface Subjective {
  visitType: string
  chronicityLevel: 'Acute' | 'Sub Acute' | 'Chronic'
  primaryBodyPart: BodyPartInfo
  secondaryBodyParts: BodyPartInfo[]
  painTypes: string[]
  painRadiation: string
  symptomDuration: SymptomDuration
  associatedSymptoms: string[]
  symptomPercentage: string
  causativeFactors: string[]
  exacerbatingFactors: string[]
  relievingFactors: string[]
  adlDifficulty: {
    level: SeverityLevel
    activities: string[]
  }
  activityChanges: string[]
  painScale: {
    worst: number
    best: number
    current: number
  }
  painFrequency: string
  walkingAid?: string
  medicalHistory?: string[]
}

export interface BodyPartInfo {
  bodyPart: BodyPart
  laterality: Laterality
  region?: string
}

export interface SymptomDuration {
  value: number
  unit: 'day(s)' | 'week(s)' | 'month(s)' | 'year(s)'
  recentWorsening?: {
    value: number
    unit: 'day(s)' | 'week(s)' | 'month(s)' | 'year(s)'
  }
}

export interface Objective {
  muscleTesting: MuscleTesting
  rom: ROMAssessment[]
  inspection: string[]
  tonguePulse: TonguePulse
}

export interface MuscleTesting {
  tightness: MuscleAssessment
  tenderness: MuscleAssessment
  spasm: MuscleAssessment
}

export interface MuscleAssessment {
  muscles: string[]
  gradingScale: string
}

export interface ROMAssessment {
  movement: string
  strength: string
  degrees: string
}

export interface TonguePulse {
  tongue: string
  pulse: string
}

export interface Assessment {
  tcmDiagnosis: {
    localPattern: string
    systemicPattern: string
    bodyPart: string
  }
  treatmentPrinciples: {
    focusOn: string
    harmonize: string
    purpose: string
  }
  evaluationArea: string
  patientCondition?: string
  changeFromLastVisit?: string
}

export interface Plan {
  evaluationType: 'Initial Evaluation' | 'Re-Evaluation'
  contactTime: string
  steps: string[]
  shortTermGoal?: TreatmentGoal
  longTermGoal?: TreatmentGoal
  needleProtocol: NeedleProtocol
}

export interface TreatmentGoal {
  treatmentFrequency: number
  weeksDuration: string
  painScaleTarget: string
  symptomTargets: SymptomTarget[]
}

export interface SymptomTarget {
  symptom: string
  targetValue: string
}

export interface NeedleProtocol {
  needleSizes: string[]
  totalTime: number
  sections: NeedleSection[]
}

export interface NeedleSection {
  name: string
  duration: number
  steps: NeedleStep[]
}

export interface NeedleStep {
  stepNumber: number
  preparation: string[]
  electricalStimulation: 'with' | 'without'
  points: string[]
}

// ==================== 诊断代码 ====================

export interface DiagnosisCode {
  icd10: string
  description: string
  bodyPart: BodyPart
  laterality?: Laterality
}

export interface ProcedureCode {
  cpt: string
  description: string
  units: number
  electricalStimulation: boolean
}

// ==================== 校验结果 ====================

export interface ValidationResult {
  isValid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  info: ValidationIssue[]
}

export interface ValidationIssue {
  code: string
  severity: ValidationSeverity
  message: string
  field?: string
  section?: 'S' | 'O' | 'A' | 'P'
  suggestion?: string
}

// ==================== 生成上下文 ====================

export interface GenerationContext {
  noteType: NoteType
  insuranceType: InsuranceType
  primaryBodyPart: BodyPart
  secondaryBodyParts?: BodyPart[]
  laterality: Laterality
  localPattern: string
  systemicPattern: string
  chronicityLevel: 'Acute' | 'Sub Acute' | 'Chronic'
  severityLevel: SeverityLevel
  hasPacemaker?: boolean
  hasMetalImplant?: boolean
  previousIE?: SOAPNote
  /**
   * 原始 SOAP 数据 (用于 Checker 修正时保留原始字段)
   */
  originalSOAP?: SOAPNote
  /**
   * 患者基础体质状况 (基于年龄、基础病、整体证型)
   * 这是固定属性，不随治疗进度变化
   * - 'good': 年轻、体质好、无严重基础病
   * - 'fair': 中年、有轻度基础病或虚证
   * - 'poor': 老年、体质弱、多重基础病或严重虚证
   * 若未指定，系统会根据 systemicPattern + chronicityLevel 自动推断
   */
  baselineCondition?: 'good' | 'fair' | 'poor'
  /**
   * 伴随症状类型 (用于 Goals 中的症状描述)
   * - 'soreness': 酸痛 (默认)
   * - 'weakness': 无力
   * - 'stiffness': 僵硬
   * - 'heaviness': 沉重
   * - 'numbness': 麻木
   */
  associatedSymptom?: 'soreness' | 'weakness' | 'stiffness' | 'heaviness' | 'numbness'
  /** 用户实际输入的当前疼痛值 (数字, 0-10) */
  painCurrent?: number
  /** 用户输入的最痛评分 (数字, 0-10) */
  painWorst?: number
  /** 用户输入的最轻评分 (数字, 0-10) */
  painBest?: number
  /** 用户选择的疼痛类型 */
  painTypes?: string[]
  /** 用户选择的症状量表百分比 (如 "70%") */
  symptomScale?: string
  /** 用户选择的疼痛频率 (IE/TX 共用，如 "Constant (symptoms occur between 76% and 100% of the time)") */
  painFrequency?: string
  /** 用户输入的症状持续时间 { value: '3', unit: 'month(s)' } */
  symptomDuration?: { value: string; unit: string }
  /** 用户输入的放射痛描述 */
  painRadiation?: string
  /** 近期加重时长 { value: '1', unit: 'week(s)' } */
  recentWorse?: { value: string; unit: string }
  /** 用户选择的病因 */
  causativeFactors?: string[]
  /** 用户选择的加重因素 */
  exacerbatingFactors?: string[]
  /** 用户选择的缓解因素 */
  relievingFactors?: string[]
  /** 患者年龄 */
  age?: number
  /** 患者性别 */
  gender?: 'Male' | 'Female'
  /** 病史列表 */
  medicalHistory?: string[]
}

// ==================== 模板定义 ====================

export interface TemplateFile {
  filePath: string
  category: 'ie' | 'tx' | 'tone' | 'needles'
  bodyPart?: BodyPart
  pattern?: string
  insuranceCode?: string
  dropdowns: DropdownField[]
  rawContent: string
}

export interface TemplateRegistry {
  ie: Map<BodyPart, TemplateFile>
  tx: Map<BodyPart, TemplateFile>
  tone: Map<string, TemplateFile>
  needles: Map<string, TemplateFile>
}
