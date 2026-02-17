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
import { splitSOAPText } from './text-to-html'
import type { BatchData, BatchPatient, BatchVisit } from '../types'

/**
 * 根据 BatchVisit 构建 GenerationContext
 */
function buildContext(
  patient: BatchPatient,
  visit: BatchVisit
): GenerationContext {
  return {
    noteType: visit.noteType,
    insuranceType: patient.insurance,
    primaryBodyPart: visit.bodyPart,
    secondaryBodyParts: [...visit.secondaryParts],
    laterality: visit.laterality,
    localPattern: 'Qi and Blood Stagnation',
    systemicPattern: 'Liver Qi Stagnation',
    chronicityLevel: 'Chronic',
    severityLevel: 'moderate',
    age: patient.age,
    gender: patient.gender,
    medicalHistory: [...visit.history],
    hasPacemaker: visit.history.includes('Pacemaker'),
    hasMetalImplant: visit.history.includes('Metal Implant'),
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
  ieVisit: BatchVisit | undefined
): BatchVisit[] {
  if (txVisits.length === 0) return []

  const firstTX = txVisits[0]
  const context = buildContext(patient, firstTX)

  const options: TXSequenceOptions = {
    txCount: txVisits.length,
    seed: Math.floor(Math.random() * 100000),
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
 * 重新生成单个 visit 的 SOAP (用于用户调整后重新生成)
 */
export function regenerateVisit(
  patient: BatchPatient,
  visit: BatchVisit,
  seed?: number
): BatchVisit {
  return generateSingleVisit(patient, visit, seed)
}
