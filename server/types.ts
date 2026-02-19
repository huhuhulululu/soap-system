/**
 * 批量处理相关类型定义
 */

import type { NoteType, InsuranceType, BodyPart, Laterality, SeverityLevel } from '../src/types'
import type { CPTWithUnits } from '../src/shared/cpt-catalog'

export interface BatchVisit {
  readonly index: number
  readonly dos: number
  readonly noteType: NoteType
  readonly txNumber: number | null
  readonly bodyPart: BodyPart
  readonly laterality: Laterality
  readonly secondaryParts: readonly BodyPart[]
  readonly history: readonly string[]
  readonly icdCodes: ReadonlyArray<{ code: string; name: string }>
  readonly cptCodes: readonly CPTWithUnits[]
  readonly generated: {
    readonly soap: {
      readonly subjective: string
      readonly objective: string
      readonly assessment: string
      readonly plan: string
    }
    readonly fullText: string
    readonly seed: number
  } | null
  status: 'pending' | 'confirmed' | 'processing' | 'done' | 'failed'
}

export interface BatchPatientClinical {
  readonly painWorst: number
  readonly painBest: number
  readonly painCurrent: number
  readonly severityLevel: SeverityLevel
  readonly symptomDuration: { readonly value: string; readonly unit: string }
  readonly painRadiation: string
  readonly painTypes: readonly string[]
  readonly associatedSymptoms: readonly string[]
  readonly causativeFactors: readonly string[]
  readonly relievingFactors: readonly string[]
  readonly symptomScale: string
  readonly painFrequency: string
  readonly chronicityLevel: 'Acute' | 'Sub Acute' | 'Chronic'
  readonly recentWorse: { readonly value: string; readonly unit: string }
}

export interface BatchPatient {
  readonly name: string
  readonly dob: string
  readonly age: number
  readonly gender: 'Male' | 'Female'
  readonly insurance: InsuranceType
  readonly clinical: BatchPatientClinical
  readonly visits: BatchVisit[]
  readonly soapText?: string
  readonly mode?: BatchMode
}

export type BatchMode = 'full' | 'soap-only' | 'continue'

export interface BatchData {
  readonly batchId: string
  readonly createdAt: string
  readonly mode: BatchMode
  confirmed: boolean
  readonly patients: BatchPatient[]
  readonly summary: {
    readonly totalPatients: number
    readonly totalVisits: number
    readonly byType: Record<string, number>
  }
}

export interface ExcelRow {
  readonly patient: string
  readonly gender: 'M' | 'F'
  readonly insurance: string
  readonly bodyPart: string
  readonly laterality: string
  readonly icd: string
  readonly cpt: string
  readonly totalVisits: number
  readonly painWorst: string
  readonly painBest: string
  readonly painCurrent: string
  readonly symptomDuration: string
  readonly painRadiation: string
  readonly painTypes: string
  readonly associatedSymptoms: string
  readonly causativeFactors: string
  readonly relievingFactors: string
  readonly symptomScale: string
  readonly painFrequency: string
  readonly secondaryParts: string
  readonly history: string
  readonly soapText: string
  readonly chronicityLevel: string
  readonly recentWorse: string
  readonly mode?: string
}
