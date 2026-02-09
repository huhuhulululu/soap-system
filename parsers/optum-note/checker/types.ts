import type { GenerationContext, BodyPart, Laterality } from '../../../src/types'
import type { OptumNoteDocument } from '../types'

export type RuleSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface CheckError {
  id: string
  ruleId: string
  severity: RuleSeverity
  visitDate: string
  visitIndex: number
  section: 'S' | 'O' | 'A' | 'P'
  field: string
  ruleName: string
  message: string
  expected: string
  actual: string
}

export interface FieldFix {
  field: string
  original: string
  corrected: string
  reason: string
  derivedFrom?: string[]
}

export interface CorrectionItem {
  visitDate: string
  visitIndex: number
  section: 'S' | 'O' | 'A' | 'P'
  errors: CheckError[]
  fieldFixes: FieldFix[]
  correctedFullText: string
  correctedAnnotatedText: string  // With [CORRECTED: was "xxx"] markers for display
}

export interface TimelineEntry {
  visitDate: string
  visitIndex: number
  visitType: 'IE' | 'TX'
  indicators: {
    pain: { value: number; label: string; trend: '↓' | '→' | '↑'; ok: boolean }
    tenderness: { value: string; trend: '↓' | '→' | '↑'; ok: boolean }
    tightness: { value: string; trend: '↓' | '→' | '↑'; ok: boolean }
    spasm: { value: string; trend: '↓' | '→' | '↑'; ok: boolean }
    frequency: { value: string; trend: '↓' | '→' | '↑'; ok: boolean }
    rom: { summary: string; trend: '↓' | '→' | '↑'; ok: boolean }
    strength: { summary: string; trend: '↓' | '→' | '↑'; ok: boolean }
  }
  errors: CheckError[]
}

export interface ScoreBreakdown {
  ieConsistency: number
  txConsistency: number
  timelineLogic: number
  totalScore: number
  grade: 'PASS' | 'WARNING' | 'FAIL'
}

export interface CheckReport {
  patient: OptumNoteDocument['header']['patient']
  summary: {
    totalVisits: number
    visitDateRange: { first: string; last: string }
    errorCount: { critical: number; high: number; medium: number; low: number; total: number }
    scoring: ScoreBreakdown
  }
  timeline: TimelineEntry[]
  errors: CheckError[]
  corrections: CorrectionItem[]
}

export interface CheckInput {
  document: OptumNoteDocument
  insuranceType?: string
  treatmentTime?: number
}

export interface CheckOutput extends CheckReport {}

export interface BridgeResult {
  context: GenerationContext
  bodyPart: BodyPart
  laterality: Laterality
  localPattern: string
  systemicPattern: string
}
