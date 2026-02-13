/**
 * Optum Note PDF Parser
 * Parses CC Acupuncture PC SOAP Format Medical Records
 */

import {
  OptumNoteDocument,
  ParseResult,
  VisitRecord,
  DocumentHeader,
  PatientInfo,
  Subjective,
  Objective,
  Assessment,
  Plan,
  DiagnosisCode,
  ProcedureCode,
  VisitType,
  PainType,
  PainScale,
  PainScaleDetailed,
  MuscleTest,
  TendernessTest,
  SpasmTest,
  ROM,
  ROMItem,
  TonguePulse,
  NeedleSpec,
  ParseError,
  ParseWarning,
} from './types'
import { parseAdlSeverity } from '../../src/shared/field-parsers'

// ============ PDF Text Normalizer ============
/** Fix common PDF extraction artifacts where spaces break known keywords */
function normalizePdfText(text: string): string {
  let r = text

  // 1. Fix single-char split words: "S ubjective" → "Subjective"
  //    PDF renderers sometimes split at capital letter boundaries
  const brokenWords: [RegExp, string][] = [
    // SOAP sections
    [/S\s+ubjective/g, 'Subjective'],
    [/O\s+bjective/g, 'Objective'],
    [/A\s+ssessment/g, 'Assessment'],
    [/P\s+lan\b/g, 'Plan'],
    // Common clinical terms
    [/P\s+rocedure/g, 'Procedure'],
    [/D\s+iagnosis/g, 'Diagnosis'],
    [/I\s+NITIAL/g, 'INITIAL'],
    [/E\s+VALUATION/g, 'EVALUATION'],
    [/F\s+ollow/g, 'Follow'],
    [/P\s+atient/g, 'Patient'],
    [/T\s+ongue/g, 'Tongue'],
    [/P\s+ulse/g, 'Pulse'],
    [/I\s+nspection/g, 'Inspection'],
    [/T\s+ightness/g, 'Tightness'],
    [/T\s+enderness/g, 'Tenderness'],
    [/M\s+uscles/g, 'Muscles'],
    [/S\s+pasm/g, 'Spasm'],
    [/N\s+eedle/g, 'Needle'],
    [/G\s+rading/g, 'Grading'],
    [/F\s+requency/g, 'Frequency'],
    [/F\s+lexion/g, 'Flexion'],
    [/E\s+xtension/g, 'Extension'],
    [/A\s+bduction/g, 'Abduction'],
    [/A\s+dduction/g, 'Adduction'],
    [/R\s+otation/g, 'Rotation'],
    [/C\s+ervical/g, 'Cervical'],
    [/L\s+umbar/g, 'Lumbar'],
    [/S\s+trength/g, 'Strength'],
    [/S\s+timulation/g, 'Stimulation'],
    [/O\s+peration/g, 'Operation'],
    [/R\s+emoving/g, 'Removing'],
    [/W\s+alking/g, 'Walking'],
    [/M\s+edical/g, 'Medical'],
    [/C\s+ontraindication/g, 'Contraindication'],
    [/P\s+recision/g, 'Precision'],
    [/I\s+ntermittent/g, 'Intermittent'],
    [/O\s+ccasional/g, 'Occasional'],
    [/F\s+requent\b/g, 'Frequent'],
    [/C\s+onstant/g, 'Constant'],
    [/I\s+mpaired/g, 'Impaired'],
    [/P\s+rinted/g, 'Printed'],
    [/e\s+lectrical/gi, 'electrical'],
    [/s\s+timulation/gi, 'stimulation'],
  ]

  for (const [pat, fix] of brokenWords) {
    r = r.replace(pat, fix)
  }

  // 2. Fix broken "pa i n" → "pain" (mid-word splits)
  r = r.replace(/\bpa\s+i\s+n\b/gi, 'pain')

  // 3. Collapse multiple spaces to single
  r = r.replace(/ {2,}/g, ' ')

  // 4. Normalize line structure: ensure section keywords start on new lines
  //    PDF extraction often merges everything into one long line
  const sectionKeywords = [
    'Subjective:', 'Objective:', 'Assessment:', 'Plan:',
    'Inspection:', 'Tightness muscles', 'Tenderness muscles', 'Muscles spasm',
    'Muscles Strength', 'Tongue', 'Pulse',
    'Pain Scale:', 'Pain Frequency:',
    'Diagnosis Code:', 'Procedure Code:',
    'Select Needle Size', 'Total Operation Time',
    'Front Points:', 'Back Points:',
    'Today\'s TCM treatment principles:', 'Today\'s treatment principles:',
    'TCM Dx:', 'Walking aid', 'Medical history',
    'Grading Scale:', 'Tenderness Scale:', 'Frequency Grading Scale:',
  ]
  for (const kw of sectionKeywords) {
    // Add newline before keyword if not already at line start
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    r = r.replace(new RegExp(`(?<!^|\\n)\\s*(${escaped})`, 'gi'), '\n$1')
  }

  // 5. Ensure date lines (MM/DD/YYYY at start of visit) get their own line
  r = r.replace(/(?<!\/)(\d{2}\/\d{2}\/\d{4})\s+(Subjective:)/g, '$1\n$2')

  return r
}

// ============ Main Parser ============
export function parseOptumNote(text: string): ParseResult {
  const errors: ParseError[] = []
  const warnings: ParseWarning[] = []

  try {
    // Fix PDF extraction artifacts: broken words like "S ubjective" → "Subjective"
    const cleaned = normalizePdfText(text)
    const header = parseHeader(cleaned)
    if (!header) {
      errors.push({ field: 'header', message: 'Failed to parse document header' })
      return { success: false, errors, warnings }
    }

    const visitBlocks = splitVisitRecords(cleaned)
    if (visitBlocks.length === 0) {
      errors.push({ field: 'visits', message: 'No visit records found' })
      return { success: false, errors, warnings }
    }

    const visits: VisitRecord[] = []
    for (let i = 0; i < visitBlocks.length; i++) {
      const visitResult = parseVisitRecord(visitBlocks[i], i)
      if (visitResult.record) {
        visits.push(visitResult.record)
      }
      errors.push(...visitResult.errors)
      warnings.push(...visitResult.warnings)
    }

    if (visits.length === 0) {
      errors.push({ field: 'visits', message: 'Failed to parse any visit records' })
      return { success: false, errors, warnings }
    }

    // PDF 中的顺序是时间倒序（最新在前），反转为时间正序（IE 初诊在前）
    const chronologicalVisits = enrichVisitsWithInheritance(visits.reverse())

    return {
      success: true,
      document: { header, visits: chronologicalVisits },
      errors,
      warnings,
    }
  } catch (error) {
    errors.push({
      field: 'parser',
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
    return { success: false, errors, warnings }
  }
}

function enrichVisitsWithInheritance(visits: VisitRecord[]): VisitRecord[] {
  const ie = visits.find(v => v.subjective.visitType === 'INITIAL EVALUATION')
  const inheritedSystemic = ie?.assessment.systemicPattern || ie?.assessment.tcmDiagnosis?.pattern || ''

  return visits.map(v => {
    if (!v.assessment.systemicPattern && inheritedSystemic) {
      v.assessment.systemicPattern = inheritedSystemic
    }
    return v
  })
}

// ============ Header Parser ============
export function parseHeader(text: string): DocumentHeader | null {
  // Pattern A: PATIENT_NAME (DOB: MM/DD/YYYY ID: XXXXXXXXXX) Date of Service: MM/DD/YYYY Printed on: MM/DD/YYYY
  const headerPattern =
    /^([A-Z]+,\s*[A-Z\s]+)\s*\(DOB:\s*(\d{2}\/\d{2}\/\d{4})\s*ID:\s*(\d{10})\)\s*Date of Service:\s*(\d{2}\/\d{2}\/\d{4})\s*Printed on:\s*(\d{2}\/\d{2}\/\d{4})/m

  const headerMatch = text.match(headerPattern)

  // Pattern: PATIENT: NAME Gender: Male/Female
  const patientPattern = /PATIENT:\s*([A-Z]+,\s*[A-Z\s]+?)\s*Gender\s*:\s*(Male|Female)/m
  const patientMatch = text.match(patientPattern)

  // Pattern: DOB: MM/DD/YYYY AGE AS OF MM/DD/YYYY: XXy
  const agePattern = /DOB:\s*(\d{2}\/\d{2}\/\d{4})\s*AGE AS OF\s*(\d{2}\/\d{2}\/\d{4})\s*:\s*(\d+)y/m
  const ageMatch = text.match(agePattern)

  if (headerMatch) {
    const patient: PatientInfo = {
      name: headerMatch[1].trim(),
      dob: headerMatch[2],
      patientId: headerMatch[3],
      gender: (patientMatch?.[2] as 'Male' | 'Female') || 'Female',
      age: ageMatch ? parseInt(ageMatch[3], 10) : 0,
      ageAsOfDate: ageMatch?.[2] || headerMatch[5],
    }
    return { patient, dateOfService: headerMatch[4], printedOn: headerMatch[5] }
  }

  // Pattern B (PDF-extracted): CC Acupuncture PC PATIENT: NAME Gender: ... DOB: ... AGE AS OF ...
  if (patientMatch && ageMatch) {
    // Find first date after AGE line as date of service
    const ageEnd = text.indexOf(ageMatch[0]) + ageMatch[0].length
    const dateAfterAge = text.slice(ageEnd).match(/(\d{2}\/\d{2}\/\d{4})/)

    const patient: PatientInfo = {
      name: patientMatch[1].trim(),
      dob: ageMatch[1],
      patientId: '',
      gender: (patientMatch[2] as 'Male' | 'Female') || 'Female',
      age: parseInt(ageMatch[3], 10),
      ageAsOfDate: ageMatch[2],
    }
    return {
      patient,
      dateOfService: dateAfterAge?.[1] || ageMatch[2],
      printedOn: ageMatch[2],
    }
  }

  return null
}

// ============ Visit Record Splitter ============
export function splitVisitRecords(text: string): string[] {
  // Split by "Subjective" keyword (with or without colon), must be at word boundary
  const parts = text.split(/(?=\bSubjective:?[\s\n])/i)

  // Filter: must have Subjective. Procedure Code is optional (may be at end of doc)
  return parts.filter((part) => {
    return /\bSubjective:?[\s\n]/i.test(part) && part.trim().length > 200
  })
}

// ============ Visit Record Parser ============
interface VisitParseResult {
  record: VisitRecord | null
  errors: ParseError[]
  warnings: ParseWarning[]
}

export function parseVisitRecord(block: string, index: number): VisitParseResult {
  const errors: ParseError[] = []
  const warnings: ParseWarning[] = []

  const subjective = parseSubjective(block)
  if (!subjective) {
    errors.push({ field: `visit[${index}].subjective`, message: 'Failed to parse Subjective section' })
    return { record: null, errors, warnings }
  }

  const objective = parseObjective(block)
  if (!objective) {
    warnings.push({ field: `visit[${index}].objective`, message: 'Failed to parse Objective section' })
  }

  const assessment = parseAssessment(block)
  if (!assessment) {
    warnings.push({ field: `visit[${index}].assessment`, message: 'Failed to parse Assessment section' })
  }

  const plan = parsePlan(block)
  if (!plan) {
    warnings.push({ field: `visit[${index}].plan`, message: 'Failed to parse Plan section' })
  }

  const diagnosisCodes = parseDiagnosisCodes(block)
  const procedureCodes = parseProcedureCodes(block)

  if (diagnosisCodes.length === 0) {
    warnings.push({ field: `visit[${index}].diagnosisCodes`, message: 'No diagnosis codes found' })
  }

  if (procedureCodes.length === 0) {
    warnings.push({ field: `visit[${index}].procedureCodes`, message: 'No procedure codes found' })
  }

  // Build record with defaults for missing sections
  const defaultObjective: Objective = {
    inspection: 'local skin no damage or rash',
    tightnessMuscles: { muscles: [], gradingScale: 'moderate' },
    tendernessMuscles: { muscles: [], scale: 2, scaleDescription: 'moderate' },
    spasmMuscles: { muscles: [], frequencyScale: 2, scaleDescription: 'moderate' },
    rom: { bodyPart: 'Unknown', items: [] },
    tonguePulse: { tongue: 'N/A', pulse: 'N/A' },
  }

  const defaultAssessment: Assessment = {
    date: '',
    generalCondition: 'good',
    symptomChange: 'improvement',
    physicalFindingChange: '',
    currentPattern: '',
  }

  const defaultPlan: Plan = {
    needleSpecs: [],
    treatmentTime: 15,
    treatmentPosition: 'Back Points',
    acupoints: [],
    electricalStimulation: false,
    treatmentPrinciples: '',
  }

  // Try to extract visit date from block header (MM/DD/YYYY before Subjective:)
  const dateInBlock = block.match(/(\d{2}\/\d{2}\/\d{4})\s*\n?\s*Subjective:/i)
  const visitDate = dateInBlock?.[1] || ''
  if (assessment && !assessment.date && visitDate) {
    assessment.date = visitDate
  }
  if (!assessment && visitDate) {
    defaultAssessment.date = visitDate
  }

  return {
    record: {
      subjective,
      objective: objective || defaultObjective,
      assessment: assessment || defaultAssessment,
      plan: plan || defaultPlan,
      diagnosisCodes,
      procedureCodes,
    },
    errors,
    warnings,
  }
}

// ============ Subjective Parser ============
export function parseSubjective(block: string): Subjective | null {
  // Visit type - support with or without colon
  const isInitial = /Subjective:?\s*\n?\s*INITIAL EVALUATION/i.test(block)
  const visitType: VisitType = isInitial ? 'INITIAL EVALUATION' : 'Follow up visit'

  // Chief complaint - Patient c/o or Patient still c/o
  const complaintPattern = /Patient(?:\s+still)?\s+c\/o\s+(.+?)(?=Pain Scale|$)/is
  const complaintMatch = block.match(complaintPattern)
  const chiefComplaint = complaintMatch?.[1]?.trim() || ''
  const chronicityLevel = parseChronicityLevel(chiefComplaint, block)

  // Extract pain types
  const painTypes = extractPainTypes(chiefComplaint)

  // Extract body part
  const bodyPart = extractBodyPart(chiefComplaint)
  const { normalizedBodyPart, laterality } = parseBodyPartAndLaterality(chiefComplaint || bodyPart)

  // Radiation
  const radiation = !/without radiation/i.test(chiefComplaint)

  // Muscle weakness scale - handle single or comma-separated symptoms (e.g. "soreness, stiffness")
  const weaknessPattern = /muscles?\s+[\w\s,]+\(\s*scale\s+as\s+(\d+%(?:-\d+%)?)\)/i
  const weaknessMatch = block.match(weaknessPattern)
  const muscleWeaknessScale = weaknessMatch?.[1] || ''

  // ADL impairment — TX format: "impaired performing ADL's with ..."
  const adlPattern = /impaired performing ADL'?s?\s+with\s+(.+?)(?=Pain Scale|$)/is
  const adlMatch = block.match(adlPattern)
  let adlImpairment = adlMatch?.[1]?.trim() || ''
  // IE format: "There is X difficulty with ADLs like ..."
  if (!adlImpairment) {
    const ieAdlPattern = /There is\s+((?:mild|moderate|severe)(?:\s+to\s+(?:mild|moderate|severe))?)\s+difficulty with ADLs? like\s+(.+?)(?=\.\s|\n\n|Pain Scale|$)/is
    const ieAdlMatch = block.match(ieAdlPattern)
    if (ieAdlMatch) {
      adlImpairment = `${ieAdlMatch[1]} difficulty ${ieAdlMatch[2].trim()}`
    }
  }
  const adlDifficultyLevel = parseAdlSeverity(adlImpairment)

  // Pain Scale - two formats
  const painScale = parsePainScale(block)
  if (!painScale) return null

  // Pain frequency
  const freqPattern = /Pain [Ff]requency:\s*(Intermittent|Occasional|Frequent|Constant)\s*\(([^)]*?)\)/i
  const freqMatch = block.match(freqPattern)
  const painFrequency = (freqMatch?.[1] as Subjective['painFrequency']) || 'Frequent'
  const painFrequencyRange = freqMatch?.[2]?.trim() || ''

  // Walking aid (初诊)
  const walkingAidPattern = /Walking aid\s*:\s*(.+?)(?=\n|Medical history)/i
  const walkingAidMatch = block.match(walkingAidPattern)
  const walkingAid = walkingAidMatch?.[1]?.trim()

  // Medical history (初诊)
  const medHistoryPattern = /Medical history\/Contraindication or Precision:\s*(.+?)(?=\n\s*Objective|$)/i
  const medHistoryMatch = block.match(medHistoryPattern)
  const medicalHistory = medHistoryMatch?.[1]?.trim() !== 'N/A'
    ? medHistoryMatch?.[1]?.split(',').map((s) => s.trim())
    : undefined

  return {
    visitType,
    chiefComplaint,
    chronicityLevel,
    painTypes,
    bodyPart,
    bodyPartNormalized: normalizedBodyPart,
    laterality,
    radiation,
    muscleWeaknessScale,
    adlImpairment,
    adlDifficultyLevel,
    painScale,
    painFrequency,
    painFrequencyRange,
    walkingAid,
    medicalHistory,
  }
}

function parseChronicityLevel(chiefComplaint: string, block: string): Subjective['chronicityLevel'] {
  const text = `${chiefComplaint} ${block}`.toLowerCase()
  if (/\bsub\s*acute\b/.test(text)) return 'Sub Acute'
  if (/\bchronic\b/.test(text)) return 'Chronic'
  return 'Acute'
}

// parseAdlDifficultyLevel 已迁移至 src/shared/field-parsers.ts (parseAdlSeverity)

function parseBodyPartAndLaterality(raw: string): { normalizedBodyPart: string; laterality: Subjective['laterality'] } {
  const text = raw.toLowerCase()
  const laterality: Subjective['laterality'] =
    /\bbilateral\b/.test(text) ? 'bilateral' :
      /\bleft\b/.test(text) ? 'left' :
        /\bright\b/.test(text) ? 'right' :
          'unspecified'

  // Find the FIRST body part mentioned (by position in text)
  const bodyParts: Array<{ name: string; pattern: RegExp }> = [
    { name: 'KNEE', pattern: /\bknee\b/i },
    { name: 'SHOULDER', pattern: /\bshoulder\b/i },
    { name: 'ELBOW', pattern: /\belbow\b/i },
    { name: 'HIP', pattern: /\bhip\b/i },
    { name: 'NECK', pattern: /\b(?:neck|cervical)\b/i },
    { name: 'LBP', pattern: /\b(?:lower back|lbp|lumbar)\b/i },
    { name: 'UPPER_BACK', pattern: /\bupper back\b/i },
    { name: 'MIDDLE_BACK', pattern: /\b(?:mid\s*back|middle\s*back|thoracic)\b/i },
  ]

  let firstMatch: { name: string; index: number } | null = null
  for (const bp of bodyParts) {
    const match = text.match(bp.pattern)
    if (match && match.index !== undefined) {
      if (!firstMatch || match.index < firstMatch.index) {
        firstMatch = { name: bp.name, index: match.index }
      }
    }
  }

  return { normalizedBodyPart: firstMatch?.name || 'UNKNOWN', laterality }
}

// ============ Pain Scale Parser ============
export function parsePainScale(block: string): PainScale | PainScaleDetailed | null {
  // Normalize spaces around dashes: "6 - 5" → "6-5"
  const normalized = block.replace(/(\d+)\s*-\s*(\d+)/g, '$1-$2')

  // Format 1: Pain Scale: Worst: X or X-Y ; Best: Y or Y-Z ; Current: Z
  const detailedPattern = /Pain Scale:\s*Worst:\s*(\d+(?:-\d+)?)\s*;\s*Best:\s*(\d+(?:-\d+)?)\s*;\s*Current:\s*(\d+)/i
  const detailedMatch = normalized.match(detailedPattern)
  if (detailedMatch) {
    const parseValue = (val: string): number | { min: number; max: number } => {
      if (val.includes('-')) {
        const [a, b] = val.split('-').map((v) => parseInt(v, 10))
        return { min: a, max: b }
      }
      return parseInt(val, 10)
    }
    const worst = parseValue(detailedMatch[1])
    const best = parseValue(detailedMatch[2])
    const current = parseInt(detailedMatch[3], 10)
    return {
      worst: typeof worst === 'number' ? worst : worst.min,
      best,
      current,
    }
  }

  // Format 2: Pain Scale: X /10 or Pain Scale: X-Y /10
  const simplePattern = /Pain Scale:\s*(\d+(?:-\d+)?)\s*\/10/i
  const simpleMatch = normalized.match(simplePattern)
  if (simpleMatch) {
    const value = simpleMatch[1]
    if (value.includes('-')) {
      const [min, max] = value.split('-').map((v) => parseInt(v, 10))
      return { value: min, range: { min, max } }
    }
    return { value: parseInt(value, 10) }
  }

  return null
}

// ============ Pain Type Extractor ============
export function extractPainTypes(text: string): PainType[] {
  const painKeywords: PainType[] = ['Dull', 'Aching', 'Freezing', 'Shooting', 'pin & needles', 'pricking', 'weighty']
  const found: PainType[] = []

  for (const keyword of painKeywords) {
    if (new RegExp(keyword, 'i').test(text)) {
      found.push(keyword)
    }
  }

  return found
}

// ============ Body Part Extractor ============
export function extractBodyPart(text: string): string {
  const bodyParts = [
    'right knee',
    'left knee',
    'right shoulder',
    'left shoulder',
    'right elbow',
    'left elbow',
    'neck',
    'cervical',
    'lower back',
    'upper back',
    'midback',
    'middle back',
    'bilateral midback',
  ]

  for (const part of bodyParts) {
    if (new RegExp(part, 'i').test(text)) {
      return part
    }
  }

  // Try to extract from "pain along/in [body part]"
  const alongPattern = /pain\s+(?:along|in)\s+([a-z]+\s+[a-z]+(?:\s+area)?)/i
  const alongMatch = text.match(alongPattern)
  if (alongMatch) {
    return alongMatch[1].trim()
  }

  return ''
}

// ============ Objective Parser ============
export function parseObjective(block: string): Objective | null {
  // Inspection
  const inspectionPattern = /Inspection:\s*(.+?)(?=\n|tongue|Muscles Testing)/i
  const inspectionMatch = block.match(inspectionPattern)
  const inspectionText = inspectionMatch?.[1]?.trim() || 'local skin no damage or rash'

  let inspection: Objective['inspection']
  if (/joint swelling/i.test(inspectionText)) {
    inspection = 'joint swelling'
  } else if (/weak muscles/i.test(inspectionText)) {
    inspection = 'weak muscles and dry skin without luster'
  } else {
    inspection = 'local skin no damage or rash'
  }

  // Tightness muscles
  const tightnessMuscles = parseTightnessMuscles(block)
  if (!tightnessMuscles) return null

  // Tenderness muscles
  const tendernessMuscles = parseTendernessMuscles(block)
  if (!tendernessMuscles) return null

  // Spasm muscles
  const spasmMuscles = parseSpasmMuscles(block)
  if (!spasmMuscles) return null

  // ROM
  const rom = parseROM(block)
  if (!rom) return null

  // Tongue and Pulse
  const tonguePulse = parseTonguePulse(block)
  if (!tonguePulse) return null

  return {
    inspection,
    tightnessMuscles,
    tendernessMuscles,
    spasmMuscles,
    rom,
    tonguePulse,
  }
}

// ============ Muscle Test Parsers ============
export function parseTightnessMuscles(block: string): MuscleTest | null {
  // 支持有冒号和无冒号的格式
  const pattern = /Tightness muscles?\s+noted\s+along:?\s*(.+?)(?:\n\s*)?Grading Scale:\s*(mild to moderate|moderate to severe|mild|moderate|severe)/is
  const match = block.match(pattern)
  if (!match) {
    // 返回默认值而不是 null
    return { muscles: [], gradingScale: 'moderate' }
  }

  const muscles = match[1]
    .split(/,\s*(?!Band)|\s+and\s+/)
    .map((m) => m.trim().replace(/\s*\n\s*/g, ' '))
    .filter((m) => m.length > 0 && !/grading/i.test(m))
  const gradingScale = match[2].toLowerCase() as MuscleTest['gradingScale']

  return { muscles, gradingScale }
}

export function parseTendernessMuscles(block: string): TendernessTest | null {
  // 支持 "Grading Scale: (+4)" 格式
  const sectionPattern = /Tenderness muscles?\s+(?:noted\s+)?along:?\s*(.+?)(?:\n\s*)?(?:Grading|Tenderness)\s+Scale:\s*\(\+(\d)\)\s*=?\s*(.+?)(?=\n|Muscles\s*s?\s*pasm|Spasm|$)/is
  const match = block.match(sectionPattern)
  if (!match) {
    return { muscles: [], scale: 2, scaleDescription: 'moderate' }
  }

  const muscles = match[1]
    .split(/,\s*(?!Band)|\s+and\s+/)
    .map((m) => m.trim().replace(/\s*\n\s*/g, ' '))
    .filter((m) => m.length > 0 && !/grading|tenderness|scale/i.test(m))

  return {
    muscles,
    scale: parseInt(match[2], 10),
    scaleDescription: match[3].trim(),
  }
}

export function parseSpasmMuscles(block: string): SpasmTest | null {
  // 支持 "Muscles s pasm" 格式 (有空格)
  const sectionPattern = /Muscles?\s*s?\s*pasm\s+noted\s+along:?\s*(.+?):?\s*(?:\n\s*)?Frequency\s*Grading\s*Scale:\s*\(\+?(\d)\)\s*=?>?\s*(.+?)(?=\n|[A-Z][a-z]+ (?:Knee|Shoulder|elbow|Elbow|Muscles)|Muscles Strength|$)/is
  const match = block.match(sectionPattern)
  if (!match) {
    return { muscles: [], frequencyScale: 2, scaleDescription: 'moderate' }
  }

  const muscles = match[1]
    .split(/,\s*(?!Band)|\s+and\s+/)
    .map((m) => m.trim().replace(/\s*\n\s*/g, ' '))
    .filter((m) => m.length > 0 && !/frequency|grading|scale/i.test(m))

  return {
    muscles,
    frequencyScale: parseInt(match[2], 10),
    scaleDescription: match[3].trim(),
  }
}

// ============ ROM Parser ============
export function parseROM(block: string): ROM | null {
  // Body part pattern: "Left/Right Knee/Shoulder/Elbow/etc. Muscles Strength and Joint/Spine ROM"
  // Also handle: "Cervical Muscles Strength and Spine ROM Assessment:"
  const bodyPartPattern = /((?:Left|Right)\s+(?:Knee|Shoulder|Elbow|elbow)|Cervical|Lumbar)\s+Muscles Strength and (?:Joint|Spine) ROM(?:\s+Assessment)?:?/i
  const bodyPartMatch = block.match(bodyPartPattern)
  let bodyPart = bodyPartMatch?.[1] || ''

  // If not found, check if there's a standalone Muscles Strength line
  if (!bodyPart) {
    const standalonePattern = /Muscles Strength and (?:Joint|Spine) ROM/i
    if (standalonePattern.test(block)) {
      // Try to infer body part from chief complaint
      const chiefComplaint = block.match(/c\/o.*?(?:right|left)\s+(\w+)/i)
      bodyPart = chiefComplaint ? `Right ${chiefComplaint[1]}` : 'Unknown'
    }
  }

  // ROM items: X/5 or X+/5 or X-/5 Movement: XX Degrees(severity) or XX degree (severity)
  // 支持 "3+ /5" 格式 (强度和斜杠之间有空格)
  const romPattern = /(\d[+-]?)\s*\/5\s+([A-Za-z][A-Za-z\s]*)(?:\([^)]+\))?:\s*(-?\d+)\s*(?:[Dd]egrees?)?\s*\(?(\w+)\)?/g
  const items: ROMItem[] = []

  let match
  while ((match = romPattern.exec(block)) !== null) {
    items.push({
      strength: `${match[1]}/5`,
      movement: match[2].trim(),
      degrees: parseInt(match[3], 10),
      severity: match[4].toLowerCase(),
    })
  }

  if (items.length === 0) {
    return { bodyPart: bodyPart || 'Unknown', items: [] }
  }

  return { bodyPart: bodyPart || 'Unknown', items }
}

// ============ Tongue Pulse Parser ============
export function parseTonguePulse(block: string): TonguePulse | null {
  // Try multiple patterns for tongue/pulse extraction
  // Pattern 1: "tongue" ... "pulse" ... (with or without colons/newlines)
  // 支持 "tongue  big tongue with white sticky coat  pulse  string - taut" 格式
  const tonguePattern = /tongue\s*:?\s*\n?\s*(.+?)(?=\n?\s*pulse)/is
  const pulsePattern = /pulse\s*:?\s*\n?\s*(.+?)(?=\n\s*A\s*ssessment|\n\s*\d{2}\/\d{2}\/\d{4}|$)/is

  const tongueMatch = block.match(tonguePattern)
  const pulseMatch = block.match(pulsePattern)

  if (tongueMatch && pulseMatch) {
    return {
      tongue: tongueMatch[1].trim().replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-'),
      pulse: pulseMatch[1].trim().replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-'),
    }
  }

  // Pattern 2: "Tongue: xxx Pulse: xxx" on same line
  const combinedPattern = /tongue\s*:?\s*(.+?)\s+pulse\s*:?\s*(.+?)(?=\n|Assessment|$)/is
  const combinedMatch = block.match(combinedPattern)
  if (combinedMatch) {
    return {
      tongue: combinedMatch[1].trim(),
      pulse: combinedMatch[2].trim(),
    }
  }

  // Fallback: return N/A
  return { tongue: 'N/A', pulse: 'N/A' }
}

// ============ Assessment Parser ============
export function parseAssessment(block: string): Assessment | null {
  // Must have Assessment keyword (with or without colon)
  if (!/Assessment\s*:?[\s\n]/i.test(block)) return null

  // Date pattern: standalone date near Assessment or at block start
  const datePattern = /(\d{2}\/\d{2}\/\d{4})\s*\n?\s*(?:Assessment:|Tongue)/i
  const dateMatch = block.match(datePattern)
  // Also try date at very start of block
  const blockDateMatch = block.match(/^(\d{2}\/\d{2}\/\d{4})/)
  const date = dateMatch?.[1] || blockDateMatch?.[1] || ''

  // General condition
  const conditionPattern = /general condition is\s+(good|fair|poor)/i
  const conditionMatch = block.match(conditionPattern)
  const generalCondition = (conditionMatch?.[1]?.toLowerCase() as 'good' | 'fair' | 'poor') || 'good'

  // Symptom change
  const symptomPattern = /presents with\s+(improvement|slight improvement|no change|exacerbate)/i
  const symptomMatch = block.match(symptomPattern)
  const symptomChange = (symptomMatch?.[1]?.toLowerCase() as Assessment['symptomChange']) || 'improvement'

  // Physical finding change
  const physicalPattern = /physical finding has\s+(.+?)(?=\.\s+Patient|$)/is
  const physicalMatch = block.match(physicalPattern)
  const physicalFindingChange = physicalMatch?.[1]?.trim() || ''

  // Current pattern - try multiple formats
  // Format 1: "Current patient still has X"
  // Format 2: From TCM Dx "due to X in local meridian"
  const patternPattern = /Current patient still has\s+(.+?)(?=\.\n|\.\s|that cause)/is
  const patternMatch = block.match(patternPattern)
  let currentPattern = patternMatch?.[1]?.trim() || ''

  // If not found, try to extract from TCM Dx
  if (!currentPattern) {
    const tcmLocalPattern = /due to\s+(.+?)\s+in local meridian/i
    const tcmLocalMatch = block.match(tcmLocalPattern)
    currentPattern = tcmLocalMatch?.[1]?.trim() || ''
  }

  const localPattern = normalizeLocalPattern(currentPattern)

  // TCM Diagnosis (初诊)
  let tcmDiagnosis = undefined
  let systemicFromTcm: string | undefined
  const tcmPattern = /TCM Dx\s*:\s*\n?\s*(.+?)(?=Today's TCM|$)/is
  const tcmMatch = block.match(tcmPattern)
  if (tcmMatch) {
    const diagPattern = /(.+?)\s+due to\s+(.+?)(?:,\s*but|in local)/is
    const diagMatch = tcmMatch[1].match(diagPattern)
    const principlesPattern = /Today's TCM treatment principles\s*:\s*\n?\s*(.+?)(?=Acupuncture Eval|Plan|$)/is
    const principlesMatch = block.match(principlesPattern)
    const systemicMatch = tcmMatch[1].match(/but patient also has\s+(.+?)\s+in the general/is)

    if (diagMatch) {
      tcmDiagnosis = {
        diagnosis: diagMatch[1].trim(),
        pattern: diagMatch[2].trim(),
        treatmentPrinciples: principlesMatch?.[1]?.trim() || '',
      }
      systemicFromTcm = systemicMatch?.[1]?.trim()
    }
  }

  return {
    date,
    generalCondition,
    symptomChange,
    physicalFindingChange,
    tcmDiagnosis,
    currentPattern,
    localPattern,
    systemicPattern: systemicFromTcm || undefined,
  }
}

function normalizeLocalPattern(currentPattern: string): string {
  if (!currentPattern) return ''
  return currentPattern
    .replace(/\sin\s+local\s+meridian.*$/i, '')
    .replace(/\s+that\s+cause.*$/i, '')
    .trim()
}

// ============ Plan Parser ============
export function parsePlan(block: string): Plan | null {
  // Needle specs: 36#x0.5", 34#x1", 30# x1.5"
  const needlePattern = /Select Needle Size\s*:\s*(.+?)(?=\n|Daily|Total)/i
  const needleMatch = block.match(needlePattern)
  const needleSpecs = parseNeedleSpecs(needleMatch?.[1] || '')

  // Treatment time
  const timePattern = /Total Operation Time\s*:\s*(\d+)\s*mins?/i
  const timeMatch = block.match(timePattern)
  const treatmentTime = timeMatch ? parseInt(timeMatch[1], 10) : 15

  // Treatment position
  const positionPattern = /(Front|Back)\s*Points\s*:/i
  const positionMatch = block.match(positionPattern)
  const treatmentPosition = (positionMatch ? positionMatch[1] + ' Points' : 'Back Points') as Plan['treatmentPosition']

  // Acupoints — try multiple patterns
  let acupoints: string[] = []
  // Pattern 1: after "with/without electrical stimulation"
  const acupointsPattern1 = /(?:with|without)\s+electrical\s+stimulation\s+([A-Z0-9,\s]+?)(?=\n\n|\nRemoving|Removing|Diagnosis|$)/i
  const acupointsMatch1 = block.match(acupointsPattern1)
  if (acupointsMatch1) {
    acupoints = acupointsMatch1[1].split(/,\s*/).map(a => a.trim()).filter(a => a.length > 0 && /^[A-Z]/.test(a))
  }
  // Pattern 2: after "Front/Back Points:"
  if (acupoints.length === 0) {
    const acupointsPattern2 = /(?:Front|Back)\s*Points\s*:\s*(.+?)(?=\n\n|Removing|Diagnosis|Total|$)/is
    const acupointsMatch2 = block.match(acupointsPattern2)
    if (acupointsMatch2) {
      acupoints = acupointsMatch2[1].split(/,\s*/).map(a => a.trim()).filter(a => a.length > 0 && /^[A-Z]/.test(a))
    }
  }

  // Electrical stimulation
  const electricalStimulation = /with electrical stimulation/i.test(block)

  // Treatment principles
  const principlesPattern = /Today's treatment principles\s*:\s*\n?\s*(.+?)(?=\n\s*Diagnosis Code|Diagnosis Code|$)/is
  const principlesMatch = block.match(principlesPattern)
  const treatmentPrinciples = principlesMatch?.[1]?.trim() || ''

  // Parse Goals (IE only)
  const shortTermGoal = parseGoal(block, 'Short Term Goal')
  const longTermGoal = parseGoal(block, 'Long Term Goal')

  // Only return null if we found absolutely nothing
  if (!needleMatch && !timeMatch && !positionMatch && acupoints.length === 0) return null

  return {
    needleSpecs,
    treatmentTime,
    treatmentPosition,
    acupoints,
    electricalStimulation,
    shortTermGoal,
    longTermGoal,
    treatmentPrinciples,
  }
}

// ============ Goal Parser ============
function parseGoal(block: string, goalType: 'Short Term Goal' | 'Long Term Goal'): Plan['shortTermGoal'] | undefined {
  const endMarker = goalType === 'Short Term Goal' ? 'Long Term Goal' : 'Select Needle'
  const pattern = new RegExp(`${goalType}\\s*\\([^)]+\\)\\s*:?\\s*(.+?)(?=${endMarker}|$)`, 'is')
  const match = block.match(pattern)
  if (!match) return undefined

  const section = match[1]

  // Frequency from header
  const freqMatch = block.match(new RegExp(`${goalType}\\s*\\(([^)]+)\\)`, 'i'))
  const frequency = freqMatch?.[1]?.trim() || ''

  // Pain Scale target
  const painMatch = section.match(/Decrease\s+Pain\s+Scale\s+to\s+([\d\s-]+)/i)
  const painScaleTarget = painMatch?.[1]?.trim().replace(/\s+/g, '') || ''

  // Sensation target (weakness/soreness/stiffness)
  const sensationMatch = section.match(/Decrease\s+(\w+)\s+sensation\s+Scale\s+to\s+([\d%]+)/i)
  const sensationScaleTarget = sensationMatch ? `${sensationMatch[2]}` : ''

  // Tightness target
  const tightnessMatch = section.match(/Tightness\s+to\s+(mild|moderate|severe|mild\s*-\s*moderate|moderate\s*-\s*severe)/i)
  const tightnessTarget = tightnessMatch?.[1]?.trim() || ''

  // Tenderness target
  const tendernessMatch = section.match(/Tenderness\s+to\s+Grade\s*(\d)/i)
  const tendernessTarget = tendernessMatch ? `Grade ${tendernessMatch[1]}` : ''

  // Spasms target
  const spasmsMatch = section.match(/Spasms\s+to\s+Grade\s*(\d)/i)
  const spasmsTarget = spasmsMatch ? `Grade ${spasmsMatch[1]}` : ''

  // Strength target
  const strengthMatch = section.match(/Strength\s+to\s+([\d+-]+)/i)
  const strengthTarget = strengthMatch?.[1]?.trim() || ''

  // ROM target (LT only)
  const romMatch = section.match(/(?:Increase\s+)?ROM\s+([\d%]+)/i)
  const romTarget = romMatch?.[1]?.trim() || undefined

  // ADL target (LT only)
  const adlMatch = section.match(/Activities\s+of\s+Daily\s+Living\s+to\s+(mild|moderate|severe|mild\s*-\s*moderate|moderate\s*-\s*severe)/i)
  const adlTarget = adlMatch?.[1]?.trim() || undefined

  if (!painScaleTarget && !tightnessTarget && !tendernessTarget) return undefined

  return {
    frequency,
    painScaleTarget,
    sensationScaleTarget,
    tightnessTarget,
    tendernessTarget,
    spasmsTarget,
    strengthTarget,
    romTarget,
    adlTarget
  }
}

// ============ Needle Specs Parser ============
export function parseNeedleSpecs(text: string): NeedleSpec[] {
  const specs: NeedleSpec[] = []
  const pattern = /(\d+)#\s*x?\s*([\d.]+)"/g

  let match
  while ((match = pattern.exec(text)) !== null) {
    specs.push({
      gauge: `${match[1]}#`,
      length: `${match[2]}"`,
    })
  }

  return specs
}

// ============ Diagnosis Code Parser ============
export function parseDiagnosisCodes(block: string): DiagnosisCode[] {
  const codes: DiagnosisCode[] = []
  // Handle both "Diagnosis Code: (1) desc (M25.561)" and "Diagnosis Code : (1) desc (M25.561)"
  const pattern = /Diagnosis Code\s*:\s*\(?\d+\)?\s*(.+?)\(([A-Z]\d+\.?\d*)\)/gi

  let match
  while ((match = pattern.exec(block)) !== null) {
    codes.push({
      description: match[1].trim(),
      icd10: match[2],
    })
  }

  return codes
}

// ============ Procedure Code Parser ============
export function parseProcedureCodes(block: string): ProcedureCode[] {
  const codes: ProcedureCode[] = []
  // Handle "Procedure Code: desc (97810)" and "Procedure Code : (1) desc (97810)"
  const pattern = /Procedure Code\s*:\s*(?:\(?\d+\)?\s*)?(.+?)\((\d+(?:-\d+)?)\)/gi

  let match
  while ((match = pattern.exec(block)) !== null) {
    codes.push({
      description: match[1].trim(),
      cpt: match[2],
    })
  }

  // Handle multi-line procedure codes
  const multiPattern = /\((\d+)\)\s*(.+?)\((\d+(?:-\d+)?)\)/g
  const multiSection = block.match(/Procedure Code\s*:[\s\S]+?(?=\n\n|Printed on|$)/i)?.[0] || ''

  let multiMatch: RegExpExecArray | null
  while ((multiMatch = multiPattern.exec(multiSection)) !== null) {
    const exists = codes.some((c) => c.cpt === multiMatch![3])
    if (!exists) {
      codes.push({
        description: multiMatch[2].trim(),
        cpt: multiMatch[3],
      })
    }
  }

  return codes
}
