/**
 * Optum Note PDF Parser
 * CC Acupuncture PC SOAP Format Medical Records
 *
 * @example
 * ```typescript
 * import { parseOptumNote } from './parsers/optum-note'
 *
 * const result = parseOptumNote(pdfText)
 * if (result.success) {
 *   console.log('Patient:', result.document.header.patient.name)
 *   console.log('Visits:', result.document.visits.length)
 *
 *   // visits[0] 是 IE 初诊，按时间正序排列
 *   result.document.visits.forEach((visit, i) => {
 *     console.log(`第 ${i + 1} 次: ${visit.subjective.visitType}`)
 *   })
 * }
 * ```
 */

// Types
export type {
  PatientInfo,
  DocumentHeader,
  VisitType,
  PainType,
  PainFrequency,
  PainScale,
  PainScaleDetailed,
  Subjective,
  GradingScale,
  MuscleTest,
  TendernessTest,
  SpasmTest,
  ROMItem,
  ROM,
  InspectionType,
  TonguePulse,
  Objective,
  TCMDiagnosis,
  Assessment,
  NeedleSpec,
  TreatmentGoal,
  Plan,
  DiagnosisCode,
  ProcedureCode,
  VisitRecord,
  OptumNoteDocument,
  ParseResult,
  ParseError,
  ParseWarning,
} from './types'

// Main parser
export { parseOptumNote } from './parser'

// Utility parsers (for advanced use cases)
export {
  parseHeader,
  splitVisitRecords,
  parseVisitRecord,
  parseSubjective,
  parseObjective,
  parseAssessment,
  parsePlan,
  parsePainScale,
  extractPainTypes,
  extractBodyPart,
  parseTightnessMuscles,
  parseTendernessMuscles,
  parseSpasmMuscles,
  parseROM,
  parseTonguePulse,
  parseDiagnosisCodes,
  parseProcedureCodes,
  parseNeedleSpecs,
} from './parser'

// Checker
export type {
  RuleSeverity,
  CheckError,
  FieldFix,
  CorrectionItem,
  TimelineEntry,
  ScoreBreakdown,
  CheckReport,
  CheckInput,
  CheckOutput,
  BridgeResult
} from './checker'

export {
  bridgeToContext,
  bridgeVisitToSOAPNote,
  parseBodyPartString,
  extractLocalPattern,
  checkDocument,
  generateCorrections,
} from './checker'
