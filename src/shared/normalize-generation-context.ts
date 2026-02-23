/**
 * Shared normalizer for GenerationContext + initialState construction.
 *
 * Single entry point for both batch (server/services/batch-generator.ts)
 * and compose (frontend/src/composables/useSOAPGeneration.ts) paths.
 *
 * - TCM pattern inference via inferLocalPatterns / inferSystemicPatterns
 * - initialState computation (tightness/tenderness/spasm from pain level)
 * - Compose user-selected overrides take priority over inference
 * - Returns new objects (immutable)
 */

import type { GenerationContext, BodyPart, Laterality, NoteType, InsuranceType, SeverityLevel } from '../types'
import type { TXSequenceOptions } from '../generator/tx-sequence-engine'
import { inferLocalPatterns, inferSystemicPatterns } from '../knowledge/medical-history-engine'

export interface NormalizeInput {
  // Required
  readonly noteType: NoteType
  readonly insuranceType: InsuranceType
  readonly primaryBodyPart: BodyPart
  readonly laterality: Laterality
  readonly painCurrent: number

  // Optional with inference (compose user selections override inference)
  readonly localPattern?: string
  readonly systemicPattern?: string

  // Optional with defaults
  readonly tightness?: number
  readonly tenderness?: number
  readonly spasm?: number
  readonly frequency?: number
  readonly associatedSymptom?: 'soreness' | 'weakness' | 'stiffness' | 'heaviness' | 'numbness'
  /** Full associated symptoms array for TCM inference (batch passes all, compose passes single) */
  readonly associatedSymptoms?: readonly string[]
  readonly painTypes?: readonly string[]
  readonly symptomScale?: string

  // Patient data
  readonly age?: number
  readonly gender?: 'Male' | 'Female'
  readonly medicalHistory?: readonly string[]
  readonly chronicityLevel?: 'Acute' | 'Sub Acute' | 'Chronic'
  readonly severityLevel: SeverityLevel

  // Additional GenerationContext fields
  readonly secondaryBodyParts?: readonly string[]
  readonly painWorst?: number
  readonly painBest?: number
  readonly symptomDuration?: { readonly value: string; readonly unit: string }
  readonly painRadiation?: string
  readonly recentWorse?: { readonly value: string; readonly unit: string }
  readonly painFrequency?: string
  readonly causativeFactors?: readonly string[]
  readonly relievingFactors?: readonly string[]
  readonly exacerbatingFactors?: readonly string[]
  readonly baselineCondition?: 'good' | 'fair' | 'poor'
}

export interface NormalizeOutput {
  readonly context: GenerationContext
  readonly initialState: NonNullable<TXSequenceOptions['initialState']>
}

/**
 * Derive frequency level from painFrequency text.
 * Constant=3, Frequent=2, Occasional=1, Intermittent=0, default=3
 */
function frequencyFromText(freqText: string | undefined): number {
  if (!freqText) return 3
  if (freqText.includes('Constant')) return 3
  if (freqText.includes('Frequent')) return 2
  if (freqText.includes('Occasional')) return 1
  if (freqText.includes('Intermittent')) return 0
  return 3
}

/**
 * Build a canonical GenerationContext + initialState from raw input.
 *
 * TCM patterns: inferred from clinical data by default, overridable
 * by explicit values (compose user selections).
 *
 * initialState tightness/tenderness/spasm: canonical formula is
 * `painCurrent >= 7 ? 3 : 2` — matching the batch path baseline
 * that the 30 fixture snapshots were captured against.
 */
export function normalizeGenerationContext(input: NormalizeInput): NormalizeOutput {
  const history = input.medicalHistory ? [...input.medicalHistory] : []
  const chronicityLevel = input.chronicityLevel ?? 'Chronic'
  const painTypes = input.painTypes ? [...input.painTypes] : ['Dull', 'Aching']
  const associatedSymptom = input.associatedSymptom ?? 'soreness'

  // TCM inference (overridable by compose user selections)
  const symptomsForInference = input.associatedSymptoms
    ? [...input.associatedSymptoms]
    : [associatedSymptom]
  const localCandidates = inferLocalPatterns(
    painTypes,
    symptomsForInference,
    input.primaryBodyPart,
    chronicityLevel,
  )
  const systemicCandidates = inferSystemicPatterns(history, input.age)

  const localPattern = input.localPattern
    ?? (localCandidates.length > 0 ? localCandidates[0].pattern : 'Qi Stagnation')
  const systemicPattern = input.systemicPattern
    ?? (systemicCandidates.length > 0 ? systemicCandidates[0].pattern : 'Kidney Yang Deficiency')

  // Canonical initialState formula (matches batch path baseline)
  const initLevel = input.painCurrent >= 7 ? 3 : 2
  const tightness = input.tightness ?? initLevel
  const tenderness = input.tenderness ?? initLevel
  const spasm = input.spasm ?? initLevel
  const frequency = input.frequency ?? frequencyFromText(input.painFrequency)

  // Constraint flags
  const hasPacemaker = history.includes('Pacemaker')
  const hasMetalImplant = history.includes('Metal Implant') || history.includes('Joint Replacement')

  const context: GenerationContext = {
    noteType: input.noteType,
    insuranceType: input.insuranceType,
    primaryBodyPart: input.primaryBodyPart,
    secondaryBodyParts: input.secondaryBodyParts ? [...input.secondaryBodyParts] as BodyPart[] : undefined,
    laterality: input.laterality,
    localPattern,
    systemicPattern,
    chronicityLevel,
    severityLevel: input.severityLevel,
    painCurrent: input.painCurrent,
    painWorst: input.painWorst,
    painBest: input.painBest,
    painTypes,
    associatedSymptom,
    symptomDuration: input.symptomDuration ? { ...input.symptomDuration } : undefined,
    painRadiation: input.painRadiation,
    symptomScale: input.symptomScale,
    painFrequency: input.painFrequency,
    causativeFactors: input.causativeFactors ? [...input.causativeFactors] : undefined,
    relievingFactors: input.relievingFactors ? [...input.relievingFactors] : undefined,
    exacerbatingFactors: input.exacerbatingFactors ? [...input.exacerbatingFactors] : undefined,
    recentWorse: input.recentWorse ? { ...input.recentWorse } : undefined,
    age: input.age,
    gender: input.gender,
    medicalHistory: history.length > 0 ? history : undefined,
    hasPacemaker,
    hasMetalImplant,
    baselineCondition: input.baselineCondition,
  }

  const initialState: NonNullable<TXSequenceOptions['initialState']> = {
    pain: input.painCurrent,
    tightness,
    tenderness,
    spasm,
    frequency,
    associatedSymptom,
    symptomScale: input.symptomScale,
    painTypes,
  }

  return { context, initialState }
}
