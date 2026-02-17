/**
 * 批量处理相关类型定义
 */

import type { NoteType, InsuranceType, BodyPart, Laterality } from '../../src/types'
import type { CPTWithUnits } from '../../src/shared/cpt-catalog'

export interface BatchVisit {
  readonly index: number
  readonly dos: number
  readonly noteType: NoteType
  readonly txNumber: number | null
  readonly bodyPart: BodyPart
  readonly laterality: Laterality
  readonly secondaryParts: readonly BodyPart[]
  readonly history: readonly string[]
  readonly icdCodes: readonly Array<{ code: string; name: string }>
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

export interface BatchPatient {
  readonly name: string
  readonly dob: string
  readonly age: number
  readonly gender: 'Male' | 'Female'
  readonly insurance: InsuranceType
  readonly visits: BatchVisit[]
}

export interface BatchData {
  readonly batchId: string
  readonly createdAt: string
  confirmed: boolean
  readonly patients: BatchPatient[]
  readonly summary: {
    readonly totalPatients: number
    readonly totalVisits: number
    readonly byType: Record<string, number>
  }
}

export interface ExcelRow {
  readonly dos: number
  readonly patient: string
  readonly gender: 'M' | 'F'
  readonly insurance: string
  readonly bodyPart: string
  readonly laterality: string
  readonly noteType: string
  readonly icd: string
  readonly cpt: string
  readonly secondaryParts: string
  readonly history: string
}
