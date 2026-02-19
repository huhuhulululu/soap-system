/**
 * Synthetic Test Data Generator
 * 生成 OptumNoteDocument 对象，直接喂给 checkDocument
 * 支持：完美文档生成、单规则错误注入、批量生成
 */
import type {
  OptumNoteDocument, VisitRecord, DocumentHeader, PatientInfo,
  Subjective, Objective, Assessment, Plan,
  DiagnosisCode, ProcedureCode, TonguePulse,
  MuscleTest, TendernessTest, SpasmTest, ROM, ROMItem, NeedleSpec,
  TreatmentGoal, GradingScale, PainType, VisitType,
} from '../../../../parsers/optum-note/types'
import { severityFromPain, expectedTenderMinScaleByPain } from '../../../../src/shared/severity'

// ============ Config Types ============

export type BodyPartKey = 'LBP' | 'KNEE' | 'SHOULDER' | 'NECK'

export interface DocConfig {
  visitCount?: number          // total visits including IE (default 12)
  bodyPart?: BodyPartKey
  laterality?: 'left' | 'right' | 'bilateral'
  painStart?: number           // IE pain (default 8)
  insuranceType?: string
  treatmentTime?: number
  hasPacemaker?: boolean
  localPattern?: string
  systemicPattern?: string
  seed?: number
  injectErrors?: ErrorInjection[]
}

export interface ErrorInjection {
  ruleId: string
  visitIndex?: number          // default: auto-pick appropriate visit
}

// ============ Constants ============

const BODY_PART_ICD: Record<BodyPartKey, { base: string; desc: string }> = {
  LBP: { base: 'M54.5', desc: 'Low back pain' },
  KNEE: { base: 'M25.56', desc: 'Pain in knee' },
  SHOULDER: { base: 'M25.51', desc: 'Pain in shoulder' },
  NECK: { base: 'M54.2', desc: 'Cervicalgia' },
}

const LAT_SUFFIX: Record<string, string> = {
  right: '1', left: '2', bilateral: '3',
}

// Muscle names must contain checker's keywords (O8 rule)
// LBP: iliocostalis/spinalis/longissimus/iliopsoas/quadratus/gluteal/multifidus
// KNEE: gluteus/piriformis/quadratus/adductor/ITB/rectus/gastronemius/hamstring/tibialis/femoris
// SHOULDER: trapezius/deltoid/supraspinatus/infraspinatus/subscapularis/rhomboid/levator/bicep
// NECK: scalene/levator/trapezius/sternocleidomastoid/semispinalis/splenius/suboccipital
const BODY_PART_MUSCLES: Record<BodyPartKey, string[]> = {
  LBP: ['Iliocostalis Lumborum', 'Quadratus Lumborum', 'Multifidus'],
  KNEE: ['Rectus Femoris', 'Hamstring', 'Gastronemius'],
  SHOULDER: ['Deltoid', 'Supraspinatus', 'Infraspinatus', 'Trapezius'],
  NECK: ['Trapezius', 'Sternocleidomastoid', 'Levator Scapulae'],
}

// ROM normals must match checker's normalDegrees (O1 rule)
// Movement names must match checker's validMovements via .includes() (O9 rule)
const BODY_PART_ROM: Record<BodyPartKey, { movement: string; normal: number }[]> = {
  LBP: [
    { movement: 'Flexion', normal: 90 },
    { movement: 'Extension', normal: 30 },
    { movement: 'Rotation', normal: 45 },
  ],
  KNEE: [
    { movement: 'Flexion', normal: 130 },
  ],
  SHOULDER: [
    { movement: 'Flexion', normal: 180 },
    { movement: 'Abduction', normal: 180 },
    { movement: 'Extension', normal: 60 },
    { movement: 'Rotation', normal: 90 },
  ],
  NECK: [
    { movement: 'Flexion', normal: 50 },
    { movement: 'Extension', normal: 60 },
    { movement: 'Rotation', normal: 80 },
  ],
}

const BODY_PART_ACUPOINTS: Record<BodyPartKey, string[]> = {
  LBP: ['BL23', 'BL25', 'BL40', 'DU4', 'GB30', 'BL60', 'KI3'],
  KNEE: ['ST34', 'ST35', 'ST36', 'GB34', 'SP9', 'SP10', 'EX-LE5'],
  SHOULDER: ['LI15', 'LI16', 'SI9', 'SI10', 'GB21', 'SJ14', 'LI4'],
  NECK: ['GB20', 'GB21', 'BL10', 'SI14', 'DU14', 'LI4', 'SI3'],
}

// Valid gauges per body part (P1 rule): LBP/KNEE=[30,34], SHOULDER/NECK=[30,34,36]
const BODY_PART_NEEDLE: Record<BodyPartKey, NeedleSpec[]> = {
  LBP: [{ gauge: '34#', length: '2"' }, { gauge: '30#', length: '1.5"' }],
  KNEE: [{ gauge: '34#', length: '1"' }, { gauge: '30#', length: '1.5"' }],
  SHOULDER: [{ gauge: '34#', length: '1.5"' }, { gauge: '36#', length: '1"' }],
  NECK: [{ gauge: '36#', length: '0.5"' }, { gauge: '34#', length: '1"' }],
}

const PATTERN_TONGUE_PULSE: Record<string, TonguePulse> = {
  'Qi Stagnation': { tongue: 'pale, thin white coat', pulse: 'wiry' },
  'Blood Stasis': { tongue: 'purple, thin coat', pulse: 'choppy' },
  'Qi & Blood Deficiency': { tongue: 'pale, thin white coat', pulse: 'thready' },
  'Cold-Damp': { tongue: 'pale, white sticky coat', pulse: 'slippery' },
  'Kidney Yang Deficiency': { tongue: 'pale, thin white coat', pulse: 'deep thready' },
  'Wind-Cold': { tongue: 'pale, thin white coat', pulse: 'tight' },
}

const TIGHTNESS_BY_PAIN: Record<number, GradingScale> = {
  10: 'severe', 9: 'severe', 8: 'moderate to severe',
  7: 'moderate to severe', 6: 'moderate', 5: 'moderate',
  4: 'mild to moderate', 3: 'mild', 2: 'mild', 1: 'mild', 0: 'mild',
}

const TENDER_DESC: Record<number, string> = {
  4: '(+4) = Patient complains of severe tenderness, withdraws immediately',
  3: '(+3) = Patient complains of considerable tenderness and withdraws momentarily',
  2: '(+2) = Patient states that the area is moderately tender',
  1: '(+1) = Patient states that the area is mildly tender-annoying',
}

const SPASM_DESC: Record<number, string> = {
  4: '(+4)=>10 spontaneous spasms per hour.',
  3: '(+3)=>1 but < 10 spontaneous spasms per hour.',
  2: '(+2)=Occasional spontaneous spasms and easily induced spasms.',
  1: '(+1)=No spontaneous spasms; vigorous stimulation results in spasms.',
  0: '(0)=No spasm',
}

const FREQ_TEXT: Record<number, string> = {
  3: 'Constant',
  2: 'Frequent',
  1: 'Occasional',
  0: 'Intermittent',
}

const FREQ_RANGE: Record<number, string> = {
  3: '76% and 100%',
  2: '51% and 75%',
  1: '26% and 50%',
  0: 'less than 25%',
}

// ============ Helpers ============

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function formatDate(offset: number): string {
  const d = new Date(2025, 0, 6 + offset * 3) // start Jan 6, every 3 days
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

// Must match checker's limitFactor formula (O1 rule)
function checkerLimitFactor(pain: number): number {
  if (pain >= 8) return 0.77
  if (pain >= 6) return 0.85
  if (pain >= 3) return 0.95
  return 1.0
}

function romDegrees(normal: number, pain: number): number {
  return Math.round(normal * checkerLimitFactor(pain))
}

// O2 rule thresholds: normal>=0.85, severe<=0.55, mild 0.5-0.95
// 'moderate' is never checked by O2 or O3, so it's always safe
function romSeverity(degrees: number, normal: number): string {
  if (normal === 0) return 'normal'
  const ratio = degrees / normal
  if (ratio >= 0.95) return 'normal'
  if (ratio > 0.55) return 'moderate'
  return 'severe'
}

// O3 rule: severity=normal needs strength>=4, severity=severe needs strength<=4
function strengthFromPain(pain: number): string {
  if (pain >= 8) return '3+/5'   // ROM moderate → O3 skips
  if (pain >= 6) return '4/5'    // ROM moderate/normal → safe
  if (pain >= 3) return '4+/5'   // ROM normal → needs >=4
  return '5/5'
}

function freqFromPain(pain: number): number {
  if (pain >= 8) return 3
  if (pain >= 5) return 2
  if (pain >= 3) return 1
  return 0
}

function symptomScaleFromPain(pain: number): string {
  if (pain >= 8) return '70%-80%'
  if (pain >= 6) return '50%-60%'
  if (pain >= 4) return '30%-40%'
  return '10%-20%'
}

// ============ Visit Builders ============

// S3 rule: ADL text must contain body-part-specific activity keywords
const ADL_BY_BODY_PART: Record<BodyPartKey, string> = {
  LBP: 'bending forward, lifting objects, and sitting for prolonged periods',
  KNEE: 'walking, climbing stairs, and squatting',
  SHOULDER: 'reaching overhead, lifting objects, and dressing',
  NECK: 'turning head, looking up, and driving',
}

function buildSubjective(
  visitType: VisitType, pain: number, bp: BodyPartKey,
  lat: string, freq: number, isIE: boolean, hasPacemaker: boolean
): Subjective {
  const base: Subjective = {
    visitType,
    chiefComplaint: `${bp === 'LBP' ? 'Low back' : bp.toLowerCase()} pain`,
    chronicityLevel: 'Chronic',
    painTypes: ['Dull', 'Aching'] as PainType[],
    bodyPart: bp === 'LBP' ? 'Low Back' : bp.charAt(0) + bp.slice(1).toLowerCase(),
    bodyPartNormalized: bp,
    laterality: lat as any,
    radiation: false,
    muscleWeaknessScale: symptomScaleFromPain(pain),
    adlImpairment: `${severityFromPain(pain)} difficulty with ${ADL_BY_BODY_PART[bp]}`,
    adlDifficultyLevel: severityFromPain(pain) as any,
    painScale: { worst: Math.min(pain + 1, 10), best: Math.max(pain - 2, 1), current: pain } as any,
    painFrequency: FREQ_TEXT[freq] as any,
    painFrequencyRange: FREQ_RANGE[freq],
  }
  if (isIE) {
    base.walkingAid = 'none'
    base.medicalHistory = hasPacemaker ? ['Pacemaker'] : ['None']
  }
  return base
}

function buildObjective(
  pain: number, bp: BodyPartKey, tonguePulse: TonguePulse
): Objective {
  const tender = expectedTenderMinScaleByPain(pain)
  const spasm = clamp(tender - 1, 0, 4)
  const muscles = BODY_PART_MUSCLES[bp]
  const romItems: ROMItem[] = BODY_PART_ROM[bp].map(r => {
    const deg = romDegrees(r.normal, pain)
    return {
      movement: r.movement,
      degrees: deg,
      severity: romSeverity(deg, r.normal),
      strength: strengthFromPain(pain),
    }
  })

  return {
    inspection: 'local skin no damage or rash',
    tightnessMuscles: { muscles, gradingScale: TIGHTNESS_BY_PAIN[pain] || 'moderate' },
    tendernessMuscles: { muscles, scale: tender, scaleDescription: TENDER_DESC[tender] || TENDER_DESC[2] },
    spasmMuscles: { muscles, frequencyScale: spasm, scaleDescription: SPASM_DESC[spasm] || SPASM_DESC[2] },
    rom: {
      bodyPart: bp === 'LBP' ? 'Lumbar' : bp.charAt(0) + bp.slice(1).toLowerCase(),
      items: romItems,
    },
    tonguePulse,
  }
}

function buildAssessment(
  date: string, pain: number, prevPain: number | null,
  bp: BodyPartKey, pattern: string, isIE: boolean
): Assessment {
  const symptomChange = isIE
    ? 'no change' as const
    : prevPain !== null && pain < prevPain
      ? 'improvement' as const
      : 'no change' as const

  const base: Assessment = {
    date,
    generalCondition: 'good',
    symptomChange,
    physicalFindingChange: symptomChange === 'improvement'
      ? 'reduced local muscles tightness'
      : 'similar local muscles tightness',
    currentPattern: `${pattern} in local meridian`,
    localPattern: pattern,
    systemicPattern: 'Kidney Yang Deficiency',
  }
  if (isIE) {
    base.tcmDiagnosis = {
      diagnosis: `${bp} pain due to ${pattern}`,
      pattern,
      treatmentPrinciples: 'Regulate Qi, activate blood circulation',
    }
  }
  return base
}

function buildPlan(
  bp: BodyPartKey, pain: number, isIE: boolean,
  hasPacemaker: boolean, treatmentTime: number
): Plan {
  const base: Plan = {
    needleSpecs: BODY_PART_NEEDLE[bp],
    treatmentTime,
    treatmentPosition: 'Back Points',
    acupoints: BODY_PART_ACUPOINTS[bp],
    electricalStimulation: !hasPacemaker,
    treatmentPrinciples: 'Regulate Qi, activate blood circulation, relieve pain',
  }
  if (isIE) {
    const sev = severityFromPain(pain) as any
    // IE05: st < pain, IE06: lt < st
    const stTarget = Math.max(pain - 3, 1)
    const ltTarget = Math.max(stTarget - 2, 0)
    base.shortTermGoal = {
      frequency: '12 treatments in 5-6 weeks',
      painScaleTarget: String(stTarget),
      sensationScaleTarget: '30%-40%',
      tightnessTarget: 'mild to moderate',
      tendernessTarget: '+2',
      spasmsTarget: '+1',
      strengthTarget: '4/5',
      romTarget: 'improved',
      adlTarget: 'improved',
    }
    base.longTermGoal = {
      frequency: '24 treatments in 10-12 weeks',
      painScaleTarget: String(ltTarget),
      sensationScaleTarget: '10%-20%',
      tightnessTarget: 'mild',
      tendernessTarget: '+1',
      spasmsTarget: '0',
      strengthTarget: '4+/5',
      romTarget: 'near normal',
      adlTarget: 'near normal',
    }
  }
  return base
}

function buildCodes(bp: BodyPartKey, hasEstim: boolean, treatmentTime: number, laterality: string): {
  diagnosisCodes: DiagnosisCode[]
  procedureCodes: ProcedureCode[]
} {
  const { base, desc } = BODY_PART_ICD[bp]
  const suffix = LAT_SUFFIX[laterality] || ''
  const icd = base + suffix
  const units = Math.ceil(treatmentTime / 15)
  const procs: ProcedureCode[] = [
    { description: 'ACUP 1/> WO ESTIM 1ST 15 MIN', cpt: '97810' },
  ]
  if (units > 1) {
    procs.push({ description: 'ACUP WO ESTIM EA ADDL 15 MIN', cpt: '97811' })
  }
  if (hasEstim) {
    procs.push({ description: 'ACUP 1/> W ESTIM 1ST 15 MIN', cpt: '97813' })
  }
  return {
    diagnosisCodes: [{ description: desc, icd10: icd }],
    procedureCodes: procs,
  }
}

// ============ Main Generator ============

export function generateDocument(config: DocConfig = {}): OptumNoteDocument {
  const {
    visitCount = 12,
    bodyPart = 'LBP',
    laterality = 'bilateral',
    painStart = 8,
    hasPacemaker = false,
    localPattern = 'Qi Stagnation',
    treatmentTime = 15,
  } = config

  const tonguePulse = PATTERN_TONGUE_PULSE[localPattern] || PATTERN_TONGUE_PULSE['Qi Stagnation']

  const header: DocumentHeader = {
    patient: {
      name: 'TEST, PATIENT',
      dob: '01/15/1970',
      patientId: '1234567890',
      gender: 'Male',
      age: 55,
      ageAsOfDate: '01/06/2025',
    },
    dateOfService: '01/06/2025',
    printedOn: '01/06/2025',
  }

  const visits: VisitRecord[] = []
  let prevPain = painStart

  for (let i = 0; i < visitCount; i++) {
    const isIE = i === 0
    // pain decreases monotonically
    const pain = isIE ? painStart : clamp(Math.round(painStart - (i / (visitCount - 1)) * (painStart - 2)), 2, prevPain)
    const freq = freqFromPain(pain)
    const date = formatDate(i)

    const subjective = buildSubjective(
      isIE ? 'INITIAL EVALUATION' : 'Follow up visit',
      pain, bodyPart, laterality, freq, isIE, hasPacemaker
    )
    const objective = buildObjective(pain, bodyPart, tonguePulse)
    const assessment = buildAssessment(date, pain, isIE ? null : prevPain, bodyPart, localPattern, isIE)
    const plan = buildPlan(bodyPart, pain, isIE, hasPacemaker, treatmentTime)
    const { diagnosisCodes, procedureCodes } = buildCodes(bodyPart, !hasPacemaker, treatmentTime, laterality)

    visits.push({ subjective, objective, assessment, plan, diagnosisCodes, procedureCodes })
    prevPain = pain
  }

  const doc: OptumNoteDocument = { header, visits }

  // Apply error injections
  if (config.injectErrors) {
    for (const injection of config.injectErrors) {
      applyInjection(doc, injection)
    }
  }

  return doc
}

// ============ Error Injection ============

function applyInjection(doc: OptumNoteDocument, injection: ErrorInjection): void {
  const visits = doc.visits
  const idx = injection.visitIndex ?? (injection.ruleId.startsWith('IE') ? 0 : Math.min(2, visits.length - 1))
  const visit = visits[idx]
  if (!visit) return

  switch (injection.ruleId) {
    // IE rules
    case 'IE01': {
      ;(visit.subjective.painScale as any).current = 9
      visit.subjective.adlImpairment = 'mild difficulty with daily activities'
      break
    }
    case 'IE02': visit.objective.tendernessMuscles.scale = 1; visit.objective.tendernessMuscles.scaleDescription = TENDER_DESC[1]; break
    case 'IE04': visit.objective.tonguePulse = { tongue: 'red, yellow coat', pulse: 'rapid' }; break
    case 'IE05': if (visit.plan.shortTermGoal) visit.plan.shortTermGoal.painScaleTarget = '9'; break
    case 'IE06': if (visit.plan.longTermGoal && visit.plan.shortTermGoal) visit.plan.longTermGoal.painScaleTarget = '9'; break
    case 'IE07': delete (visit.assessment as any).tcmDiagnosis; break
    case 'IE08': visit.plan.acupoints = []; break

    // TX rules
    case 'TX01': {
      // parseAdlSeverity reads adlImpairment text, not adlDifficultyLevel
      visit.subjective.adlImpairment = 'mild difficulty with daily activities'
      visit.subjective.adlDifficultyLevel = 'mild'
      break
    }
    case 'TX02': visit.objective.tendernessMuscles.scale = 1; visit.objective.tendernessMuscles.scaleDescription = TENDER_DESC[1]; break
    case 'TX03': {
      // TX03 checks: improvement + pain increased (delta > 0)
      visit.assessment.symptomChange = 'improvement'
      const prevPainTx03 = (visits[idx - 1]?.subjective.painScale as any)?.current ?? 7
      ;(visit.subjective.painScale as any).current = prevPainTx03 + 1
      break
    }
    case 'TX05': visit.objective.tonguePulse = { tongue: 'red, yellow coat', pulse: 'rapid' }; break
    case 'TX06': {
      visit.plan.shortTermGoal = {
        frequency: '12 treatments', painScaleTarget: '3',
        sensationScaleTarget: '30%', tightnessTarget: 'mild',
        tendernessTarget: '+1', spasmsTarget: '0',
        strengthTarget: '4/5',
      }
      break
    }

    // T rules
    case 'T02': {
      // improvement but pain worsened
      visit.assessment.symptomChange = 'improvement'
      const prevPain = (visits[idx - 1]?.subjective.painScale as any)?.current ?? 8
      ;(visit.subjective.painScale as any).current = prevPain + 1
      break
    }
    case 'T03': {
      // exacerbate but pain improved
      visit.assessment.symptomChange = 'exacerbate'
      const prevP = (visits[idx - 1]?.subjective.painScale as any)?.current ?? 8
      ;(visit.subjective.painScale as any).current = Math.max(prevP - 3, 1)
      break
    }
    case 'T06': {
      // T06 reads from chiefComplaint: parseProgressStatus + extractProgressReasons
      visit.subjective.chiefComplaint = 'improvement of symptom due to skipped treatments'
      break
    }
    case 'T07': {
      // pacemaker + electrical stimulation
      if (visits[0].subjective.medicalHistory) {
        visits[0].subjective.medicalHistory = ['Pacemaker']
      }
      visit.plan.electricalStimulation = true
      break
    }

    // Sequence rules (V01-V09)
    case 'V01': {
      // pain increases
      const prev = (visits[idx - 1]?.subjective.painScale as any)?.current ?? 7
      ;(visit.subjective.painScale as any).current = prev + 2
      break
    }
    case 'V02': {
      const prevT = visits[idx - 1]?.objective.tendernessMuscles.scale ?? 3
      visit.objective.tendernessMuscles.scale = prevT + 2
      break
    }
    case 'V03': {
      visits[idx - 1]!.objective.tightnessMuscles.gradingScale = 'mild'
      visit.objective.tightnessMuscles.gradingScale = 'moderate'
      break
    }
    case 'V04': {
      const prevS = visits[idx - 1]?.objective.spasmMuscles.frequencyScale ?? 2
      visit.objective.spasmMuscles.frequencyScale = prevS + 2
      break
    }
    case 'V05': {
      // ROM decreases
      visit.objective.rom.items.forEach(item => { item.degrees = Math.max(item.degrees - 20, 5) })
      break
    }
    case 'V06': {
      // strength decreases
      visit.objective.rom.items.forEach(item => { item.strength = '3/5' })
      break
    }
    case 'V07': {
      visit.subjective.painFrequency = 'Constant'
      visits[idx - 1]!.subjective.painFrequency = 'Occasional'
      break
    }
    case 'V09': {
      // acupoint overlap < 40%
      visit.plan.acupoints = ['SP1', 'SP2', 'SP3', 'SP4', 'SP5', 'SP6', 'SP7']
      break
    }
    case 'T08': {
      // T08 reads parseAdlSeverity from adlImpairment text
      visits[idx - 1]!.subjective.adlImpairment = 'mild difficulty with daily activities'
      visit.subjective.adlImpairment = 'moderate difficulty with daily activities'
      break
    }

    // Code rules
    case 'DX01': visit.diagnosisCodes = [{ description: 'Wrong', icd10: 'M17.0' }]; break // KNEE code on LBP
    case 'DX02': visit.diagnosisCodes = [{ description: 'Different', icd10: 'Z99.99' }]; break
    case 'DX03': visit.diagnosisCodes = []; break
    case 'CPT01': visit.procedureCodes = []; break
    case 'CPT02': {
      visit.plan.electricalStimulation = true
      visit.procedureCodes = [{ description: 'ACUP WO ESTIM', cpt: '97810' }]
      break
    }

    // Generator rules
    case 'S2': visit.subjective.painTypes = ['Pricking'] as any; break // wrong for Qi Stagnation
    case 'O8': visit.objective.tightnessMuscles.muscles = ['Trapezius']; break // wrong for KNEE
    case 'O9': visit.objective.rom.items.push({ movement: 'Abduction', degrees: 90, severity: 'moderate', strength: '4/5' }); break // invalid for LBP
    case 'A5': visit.assessment.localPattern = 'Blood Stasis'; break // inconsistent across visits
    case 'P1': visit.plan.needleSpecs = [{ gauge: '36#', length: '3"' }]; break // 36 invalid for LBP/KNEE
    case 'P2': visit.plan.acupoints = Array.from({ length: 25 }, (_, i) => `PT${i}`); break
    case 'X1': {
      // high pain but low tightness
      ;(visit.subjective.painScale as any).current = 9
      visit.objective.tightnessMuscles.gradingScale = 'mild'
      break
    }
    case 'X3': {
      const ieVisit = visits[0]
      ieVisit.assessment.localPattern = 'Kidney Yang Deficiency'
      ieVisit.assessment.systemicPattern = 'Kidney Yang Deficiency'
      ieVisit.objective.tonguePulse = { tongue: 'red, yellow coat', pulse: 'rapid' }
      break
    }
    case 'X4': {
      if (visits[0].subjective.medicalHistory) visits[0].subjective.medicalHistory = ['Pacemaker']
      visit.plan.electricalStimulation = true
      break
    }
  }
}

// ============ Batch Helpers ============

/** 生成 N 份完美文档 */
export function generatePerfectBatch(count: number, config: Partial<DocConfig> = {}): OptumNoteDocument[] {
  return Array.from({ length: count }, () => generateDocument({ ...config, injectErrors: [] }))
}

/** 为每条规则生成注入文档 */
export function generateRuleInjectionBatch(
  ruleIds: string[],
  perRule: number = 1,
  config: Partial<DocConfig> = {}
): Array<{ ruleId: string; doc: OptumNoteDocument }> {
  const results: Array<{ ruleId: string; doc: OptumNoteDocument }> = []
  for (const ruleId of ruleIds) {
    for (let i = 0; i < perRule; i++) {
      results.push({
        ruleId,
        doc: generateDocument({ ...config, injectErrors: [{ ruleId }] }),
      })
    }
  }
  return results
}
