/**
 * 批量生成服务
 *
 * 将 Excel 解析后的 BatchData 中每个 visit 调用 SOAP 生成引擎：
 * - IE/RE: exportSOAPAsText(context)
 * - TX: exportTXSeriesAsText(context, options) → 一次性生成同患者所有 TX
 *
 * 生成后将 SOAP 文本拆分为 S/O/A/P 四段，附加到 visit.generated
 */

import type { GenerationContext } from '../../src/types'
import type { TXSequenceOptions } from '../../src/generator/tx-sequence-engine'
import { exportSOAPAsText, exportTXSeriesAsText } from '../../src/generator/soap-generator'
import { inferLocalPatterns, inferSystemicPatterns } from '../../src/knowledge/medical-history-engine'
import { extractStateFromTX, buildContextFromExtracted, buildInitialStateFromExtracted } from '../../src/parser/tx-extractor'
import { splitSOAPText } from './text-to-html'
import type { BatchData, BatchPatient, BatchVisit } from '../types'

/**
 * 根据 BatchPatient + BatchVisit 构建 GenerationContext
 * 使用患者临床数据 + 自动推断 TCM 证型
 */
function buildContext(
  patient: BatchPatient,
  visit: BatchVisit
): GenerationContext {
  const { clinical } = patient
  const history = [...visit.history]

  // 自动推断 TCM 证型
  const localCandidates = inferLocalPatterns(
    [...clinical.painTypes],
    [...clinical.associatedSymptoms],
    visit.bodyPart,
    clinical.chronicityLevel ?? 'Chronic'
  )
  const systemicCandidates = inferSystemicPatterns(history, patient.age)

  const localPattern = localCandidates.length > 0
    ? localCandidates[0].pattern
    : 'Qi Stagnation'
  const systemicPattern = systemicCandidates.length > 0
    ? systemicCandidates[0].pattern
    : 'Kidney Yang Deficiency'

  return {
    noteType: visit.noteType,
    insuranceType: patient.insurance,
    primaryBodyPart: visit.bodyPart,
    secondaryBodyParts: [...visit.secondaryParts],
    laterality: visit.laterality,
    localPattern,
    systemicPattern,
    chronicityLevel: clinical.chronicityLevel ?? 'Chronic',
    severityLevel: clinical.severityLevel,
    painCurrent: clinical.painCurrent,
    painWorst: clinical.painWorst,
    painBest: clinical.painBest,
    painTypes: [...clinical.painTypes],
    associatedSymptom: clinical.associatedSymptoms[0] as GenerationContext['associatedSymptom'] ?? 'soreness',
    symptomDuration: { ...clinical.symptomDuration },
    painRadiation: clinical.painRadiation,
    symptomScale: clinical.symptomScale,
    painFrequency: clinical.painFrequency,
    causativeFactors: [...clinical.causativeFactors],
    relievingFactors: [...clinical.relievingFactors],
    recentWorse: clinical.recentWorse ? { ...clinical.recentWorse } : { value: '1', unit: 'week(s)' },
    age: patient.age,
    gender: patient.gender,
    medicalHistory: history,
    hasPacemaker: history.includes('Pacemaker'),
    hasMetalImplant: history.includes('Metal Implant') || history.includes('Joint Replacement'),
  }
}

/**
 * 为单个 visit 生成 SOAP 文本并拆分
 */
function generateSingleVisit(
  patient: BatchPatient,
  visit: BatchVisit,
  seed?: number
): BatchVisit {
  const context = buildContext(patient, visit)
  const actualSeed = seed ?? Math.floor(Math.random() * 100000)

  const fullText = exportSOAPAsText(context)
  const soap = splitSOAPText(fullText)

  return {
    ...visit,
    generated: {
      soap,
      fullText,
      seed: actualSeed,
    },
    status: 'done' as const,
  }
}

/**
 * 为同一患者的所有 TX visits 批量生成
 * 使用 TX Sequence Engine 保持纵向一致性
 */
function generateTXSeries(
  patient: BatchPatient,
  txVisits: readonly BatchVisit[],
  _ieVisit: BatchVisit | undefined
): BatchVisit[] {
  if (txVisits.length === 0) return []

  const firstTX = txVisits[0]
  const context = buildContext(patient, firstTX)
  const { clinical } = patient

  // 构建 initialState（与前端 useSOAPGeneration 一致）
  const freqText = clinical.painFrequency
  const freqLevel = freqText.includes('Constant')
    ? 3
    : freqText.includes('Frequent')
      ? 2
      : freqText.includes('Occasional')
        ? 1
        : freqText.includes('Intermittent')
          ? 0
          : 3

  const options: TXSequenceOptions = {
    txCount: txVisits.length,
    seed: Math.floor(Math.random() * 100000),
    initialState: {
      pain: clinical.painCurrent,
      tightness: clinical.painCurrent >= 7 ? 3 : 2,
      tenderness: clinical.painCurrent >= 7 ? 3 : 2,
      spasm: clinical.painCurrent >= 7 ? 3 : 2,
      frequency: freqLevel,
      associatedSymptom: (clinical.associatedSymptoms[0] as string) || 'soreness',
      symptomScale: clinical.symptomScale,
      painTypes: [...clinical.painTypes],
    },
  }

  const results = exportTXSeriesAsText(context, options)

  return txVisits.map((visit, i) => {
    const result = results[i]
    if (!result) {
      return {
        ...visit,
        status: 'failed' as const,
      }
    }

    const soap = splitSOAPText(result.text)
    return {
      ...visit,
      generated: {
        soap,
        fullText: result.text,
        seed: options.seed ?? 0,
      },
      status: 'done' as const,
    }
  })
}

export interface BatchGenerationResult {
  readonly batchId: string
  readonly totalGenerated: number
  readonly totalFailed: number
  readonly patients: BatchPatient[]
}

/**
 * 为整个 Batch 中所有患者的所有 visits 生成 SOAP
 *
 * 策略:
 * 1. 先生成 IE/RE (独立生成)
 * 2. 再生成 TX 序列 (使用 TX Sequence Engine 保持连续性)
 */
export function generateBatch(batch: BatchData): BatchGenerationResult {
  let totalGenerated = 0
  let totalFailed = 0

  const updatedPatients = batch.patients.map(patient => {
    // 分类 visits
    const ieVisit = patient.visits.find(v => v.noteType === 'IE')
    const reVisits = patient.visits.filter(v => v.noteType === 'RE')
    const txVisits = patient.visits.filter(v => v.noteType === 'TX')

    // 1. 生成 IE
    const generatedIE = ieVisit
      ? generateSingleVisit(patient, ieVisit)
      : undefined

    // 2. 生成 RE
    const generatedRE = reVisits.map(v => generateSingleVisit(patient, v))

    // 3. 生成 TX 序列
    const generatedTX = generateTXSeries(patient, txVisits, generatedIE)

    // 重新组装 visits (保持原始顺序)
    const updatedVisits = patient.visits.map(originalVisit => {
      if (originalVisit.noteType === 'IE' && generatedIE) {
        return generatedIE
      }
      const reMatch = generatedRE.find(v => v.index === originalVisit.index)
      if (reMatch) return reMatch
      const txMatch = generatedTX.find(v => v.index === originalVisit.index)
      if (txMatch) return txMatch
      return originalVisit
    })

    // 统计
    for (const v of updatedVisits) {
      if (v.status === 'done') totalGenerated++
      else if (v.status === 'failed') totalFailed++
    }

    return {
      ...patient,
      visits: updatedVisits,
    }
  })

  return {
    batchId: batch.batchId,
    totalGenerated,
    totalFailed,
    patients: updatedPatients,
  }
}

/**
 * Continue 模式：从 TX SOAP 文本提取状态并续写
 */
export function generateContinueBatch(batch: BatchData): BatchGenerationResult {
  let totalGenerated = 0
  let totalFailed = 0

  const updatedPatients = batch.patients.map(patient => {
    if (!patient.soapText) {
      return { ...patient, visits: patient.visits.map(v => ({ ...v, status: 'failed' as const })) }
    }

    const extracted = extractStateFromTX(patient.soapText)
    const context = buildContextFromExtracted(extracted, {
      insuranceType: patient.insurance,
      age: patient.age,
      gender: patient.gender,
      medicalHistory: [...(patient.visits[0]?.history ?? [])],
    })
    const initialState = buildInitialStateFromExtracted(extracted)

    const txVisits = patient.visits.filter(v => v.noteType === 'TX')
    if (txVisits.length === 0) {
      return patient
    }

    const options: TXSequenceOptions = {
      txCount: txVisits.length + extracted.estimatedVisitIndex,
      startVisitIndex: extracted.estimatedVisitIndex + 1,
      seed: Math.floor(Math.random() * 100000),
      initialState,
    }

    const results = exportTXSeriesAsText(context, options)
    const generatedTX = txVisits.map((visit, i) => {
      const result = results[i]
      if (!result) {
        totalFailed++
        return { ...visit, status: 'failed' as const }
      }
      totalGenerated++
      const soap = splitSOAPText(result.text)
      return {
        ...visit,
        generated: { soap, fullText: result.text, seed: options.seed ?? 0 },
        status: 'done' as const,
      }
    })

    const updatedVisits = patient.visits.map(v => {
      const match = generatedTX.find(g => g.index === v.index)
      return match ?? v
    })

    return { ...patient, visits: updatedVisits }
  })

  return { batchId: batch.batchId, totalGenerated, totalFailed, patients: updatedPatients }
}

/**
 * Mixed mode: generate each patient according to its own mode field
 */
export function generateMixedBatch(batch: BatchData): BatchGenerationResult {
  let totalGenerated = 0
  let totalFailed = 0

  const updatedPatients = batch.patients.map(patient => {
    const mode = patient.mode ?? batch.mode ?? 'full'

    if (mode === 'continue') {
      // Reuse continue logic inline
      if (!patient.soapText) {
        return { ...patient, visits: patient.visits.map(v => ({ ...v, status: 'failed' as const })) }
      }
      const extracted = extractStateFromTX(patient.soapText)
      const context = buildContextFromExtracted(extracted, {
        insuranceType: patient.insurance,
        age: patient.age,
        gender: patient.gender,
        medicalHistory: [...(patient.visits[0]?.history ?? [])],
      })
      const initialState = buildInitialStateFromExtracted(extracted)
      const txVisits = patient.visits.filter(v => v.noteType === 'TX')
      if (txVisits.length === 0) return patient

      const options: TXSequenceOptions = {
        txCount: txVisits.length + extracted.estimatedVisitIndex,
        startVisitIndex: extracted.estimatedVisitIndex + 1,
        seed: Math.floor(Math.random() * 100000),
        initialState,
      }
      const results = exportTXSeriesAsText(context, options)
      const generatedTX = txVisits.map((visit, i) => {
        const result = results[i]
        if (!result) { totalFailed++; return { ...visit, status: 'failed' as const } }
        totalGenerated++
        return { ...visit, generated: { soap: splitSOAPText(result.text), fullText: result.text, seed: options.seed ?? 0 }, status: 'done' as const }
      })
      const updatedVisits = patient.visits.map(v => generatedTX.find(g => g.index === v.index) ?? v)
      return { ...patient, visits: updatedVisits }
    }

    // full / soap-only: use standard generation
    const ieVisit = patient.visits.find(v => v.noteType === 'IE')
    const reVisits = patient.visits.filter(v => v.noteType === 'RE')
    const txVisits = patient.visits.filter(v => v.noteType === 'TX')
    const generatedIE = ieVisit ? generateSingleVisit(patient, ieVisit) : undefined
    const generatedRE = reVisits.map(v => generateSingleVisit(patient, v))
    const generatedTX = generateTXSeries(patient, txVisits, generatedIE)

    const updatedVisits = patient.visits.map(v => {
      if (v.noteType === 'IE' && generatedIE) return generatedIE
      const reMatch = generatedRE.find(g => g.index === v.index)
      if (reMatch) return reMatch
      return generatedTX.find(g => g.index === v.index) ?? v
    })
    for (const v of updatedVisits) {
      if (v.status === 'done') totalGenerated++
      else if (v.status === 'failed') totalFailed++
    }
    return { ...patient, visits: updatedVisits }
  })

  return { batchId: batch.batchId, totalGenerated, totalFailed, patients: updatedPatients }
}

/**
 * 重新生成单个 visit 的 SOAP (用于用户调整后重新生成)
 */
export function regenerateVisit(
  patient: BatchPatient,
  visit: BatchVisit,
  seed?: number
): BatchVisit {
  return generateSingleVisit(patient, visit, seed)
}
