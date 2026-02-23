/**
 * Excel 解析器
 *
 * 解析上传的 Excel 文件 → 每行一个患者 → 自动展开为 1 IE + (N-1) TX visits
 */

import ExcelJS from 'exceljs'
import type { BodyPart, InsuranceType, Laterality } from '../../src/types'
import type { ExcelRow, BatchPatient, BatchVisit, BatchPatientClinical, BatchMode } from '../types'
import { getICDName } from '../../src/shared/icd-catalog'
import { parseCPTString, getDefaultTXCPT, getDefaultIECPT, type CPTWithUnits } from '../../src/shared/cpt-catalog'
import { severityFromPain } from '../../src/shared/severity'
import { extractStateFromTX } from '../../src/parser/tx-extractor'

const VALID_INSURANCE = new Set<string>(['HF', 'OPTUM', 'WC', 'VC', 'ELDERPLAN', 'NONE'])

const VALID_LATERALITY = new Map<string, Laterality>([
  ['B', 'bilateral'], ['L', 'left'], ['R', 'right'],
  ['BILATERAL', 'bilateral'], ['LEFT', 'left'], ['RIGHT', 'right'],
])

const VALID_BODY_PARTS = new Set<string>([
  'LBP', 'NECK', 'UPPER_BACK', 'MIDDLE_BACK', 'MID_LOW_BACK',
  'SHOULDER', 'ELBOW', 'WRIST', 'HAND',
  'HIP', 'KNEE', 'ANKLE', 'FOOT',
  'THIGH', 'CALF', 'ARM', 'FOREARM',
  'SHLDR', 'BACK',
])

const BODY_PART_ALIAS: Record<string, BodyPart> = {
  'SHLDR': 'SHOULDER',
  'BACK': 'LBP',
}

const PAIN_FREQUENCY_MAP: Record<string, string> = {
  'INTERMITTENT': 'Intermittent (symptoms occur less than 25% of the time)',
  'OCCASIONAL': 'Occasional (symptoms occur between 26% and 50% of the time)',
  'FREQUENT': 'Frequent (symptoms occur between 51% and 75% of the time)',
  'CONSTANT': 'Constant (symptoms occur between 76% and 100% of the time)',
}

function normalizeBodyPart(raw: string): BodyPart {
  const upper = raw.toUpperCase().trim()
  const aliased = BODY_PART_ALIAS[upper]
  if (aliased) return aliased
  if (VALID_BODY_PARTS.has(upper)) return upper as BodyPart
  throw new Error(`Invalid body part: "${raw}". Valid: ${[...VALID_BODY_PARTS].join(', ')}`)
}

function parsePatientNameDOB(raw: string): { name: string; dob: string } {
  const match = raw.match(/^(.+?)\((\d{2}\/\d{2}\/\d{4})\)$/)
  if (!match) {
    throw new Error(`Invalid patient format: "${raw}". Expected: NAME(MM/DD/YYYY)`)
  }
  return { name: match[1].trim(), dob: match[2] }
}

function calculateAge(dob: string): number {
  const [month, day, year] = dob.split('/').map(Number)
  const birthDate = new Date(year, month - 1, day)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

/**
 * 解析 SymptomDuration 字符串 → {value, unit}
 * 支持: "3 year(s)", "6 month(s)", "2 week(s)"
 */
function parseSymptomDuration(raw: string): { value: string; unit: string } {
  if (!raw.trim()) return { value: '3', unit: 'year(s)' }
  const match = raw.trim().match(/^([\d.]+|more than [\d.]+|many|several)\s*(year|month|week|day)\(?s?\)?$/i)
  if (match) {
    const unit = match[2].toLowerCase()
    return { value: match[1], unit: `${unit}(s)` }
  }
  return { value: '3', unit: 'year(s)' }
}

/**
 * 解析 PainFrequency 简写 → 完整文本
 */
function parsePainFrequency(raw: string): string {
  if (!raw.trim()) return PAIN_FREQUENCY_MAP['CONSTANT']
  const upper = raw.trim().toUpperCase()
  const mapped = PAIN_FREQUENCY_MAP[upper]
  if (mapped) return mapped
  // 如果用户直接填了完整文本，原样返回
  if (raw.includes('symptoms occur')) return raw
  return PAIN_FREQUENCY_MAP['CONSTANT']
}

function parseChronicityLevel(raw: string): 'Acute' | 'Sub Acute' | 'Chronic' {
  const upper = raw.trim().toUpperCase()
  if (upper === 'ACUTE') return 'Acute'
  if (upper === 'SUB ACUTE' || upper === 'SUBACUTE') return 'Sub Acute'
  return 'Chronic'
}

function parseRecentWorse(raw: string): { value: string; unit: string } {
  if (!raw.trim()) return { value: '1', unit: 'week(s)' }
  const match = raw.trim().match(/^([\d.]+|more than [\d.]+)\s*(year|month|week|day)\(?s?\)?$/i)
  if (match) return { value: match[1], unit: `${match[2].toLowerCase()}(s)` }
  return { value: '1', unit: 'week(s)' }
}

/**
 * 解析 includeIE 字段 (支持 boolean / string / undefined)
 * 默认: full 模式 → true, 其他模式 → false
 */
function parseIncludeIE(raw: boolean | string | undefined, fallbackMode: BatchMode): boolean {
  if (raw === true || raw === 'true' || raw === '1') return true
  if (raw === false || raw === 'false' || raw === '0') return false
  // 未指定时按模式决定: full/soap-only → true, continue → false
  return fallbackMode !== 'continue'
}

/**
 * 解析疼痛值 (支持 "8", "8-7" 等格式)
 */
function parsePainValue(raw: string, fallback: number): number {
  if (!raw.trim()) return fallback
  const match = raw.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : fallback
}

/**
 * 解析逗号分隔字符串为数组
 */
function parseCSV(raw: string): string[] {
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

/**
 * 解析 Excel Buffer 为原始行数据 (async — exceljs)
 */
/**
 * 检测是否为纵向布局 (Col A = field labels, Col B+ = patients)
 */
function isVerticalLayout(sheet: ExcelJS.Worksheet): boolean {
  const a1 = String(sheet.getRow(1).getCell(1).value ?? '').trim().toLowerCase()
  return a1 === 'field'
}

/**
 * 纵向布局转换为标准 Record[] (每列一个患者)
 */
function transposeVertical(sheet: ExcelJS.Worksheet): Record<string, string>[] {
  // Row 1 = "Field", "Patient 1", "Patient 2", ...
  // Row 2+ = field label in col A, values in col B+
  const fieldKeys: string[] = []
  for (let r = 2; r <= sheet.rowCount; r++) {
    const label = String(sheet.getRow(r).getCell(1).value ?? '').trim().replace(/\s*\*$/, '')
    if (label) fieldKeys.push(label)
  }

  const colCount = sheet.getRow(1).cellCount
  const records: Record<string, string>[] = []

  for (let c = 2; c <= colCount; c++) {
    const record: Record<string, string> = {}
    let hasData = false
    for (let f = 0; f < fieldKeys.length; f++) {
      const val = String(sheet.getRow(f + 2).getCell(c).value ?? '').trim()
      record[fieldKeys[f]] = val
      if (val) hasData = true
    }
    if (hasData) records.push(record)
  }

  return records
}

export async function parseExcelBuffer(buffer: Buffer): Promise<ExcelRow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) throw new Error('Excel file has no data rows')

  // Detect layout: vertical (col A = fields) vs horizontal (row 1 = headers)
  if (isVerticalLayout(sheet)) {
    return buildRowsFromRecords(transposeVertical(sheet))
  }

  // Row 1 = headers
  const headerRow = sheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim()
  })

  // Horizontal: each row is a patient record
  const records: Record<string, string>[] = []
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const record: Record<string, string> = {}
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber] ?? `Col${colNumber}`
      record[key] = String(cell.value ?? '').trim()
    })
    if (!Object.values(record).every(v => !v)) records.push(record)
  }

  return buildRowsFromRecords(records)
}

function buildRowsFromRecords(records: Record<string, string>[]): ExcelRow[] {
  if (records.length === 0) throw new Error('Excel file has no data rows')

  return records.map((record, idx) => {
    const rowNum = idx + 2
    const getString = (keys: string[]): string => {
      for (const k of keys) { if (record[k]) return record[k] }
      return ''
    }
    const getNumber = (keys: string[], fallback?: number): number => {
      const s = getString(keys)
      if (!s && fallback !== undefined) return fallback
      const n = parseInt(s, 10)
      if (isNaN(n)) throw new Error(`Row ${rowNum}: Invalid number in column ${keys[0]}`)
      return n
    }

    return {
      patient: getString(['Patient', 'patient', 'A']),
      gender: getString(['Gender', 'gender', 'B']).toUpperCase() as 'M' | 'F',
      insurance: getString(['Insurance', 'insurance', 'Ins', 'C']).toUpperCase(),
      bodyPart: getString(['BodyPart', 'bodyPart', 'Body', 'D']).toUpperCase(),
      laterality: getString(['Laterality', 'laterality', 'Side', 'E']).toUpperCase(),
      icd: getString(['ICD', 'icd', 'F']),
      cpt: getString(['CPT', 'cpt', 'G']),
      totalVisits: getNumber(['TotalVisits', 'totalVisits', 'Total', 'H'], 12),
      painWorst: getString(['PainWorst', 'painWorst', 'I']),
      painBest: getString(['PainBest', 'painBest', 'J']),
      painCurrent: getString(['PainCurrent', 'painCurrent', 'K']),
      symptomDuration: getString(['SymptomDuration', 'symptomDuration', 'L']),
      painRadiation: getString(['PainRadiation', 'painRadiation', 'M']),
      painTypes: getString(['PainTypes', 'painTypes', 'N']),
      associatedSymptoms: getString(['AssociatedSymptoms', 'associatedSymptoms', 'O']),
      causativeFactors: getString(['CausativeFactors', 'causativeFactors', 'P']),
      relievingFactors: getString(['RelievingFactors', 'relievingFactors', 'Q']),
      symptomScale: getString(['SymptomScale', 'symptomScale', 'R']),
      painFrequency: getString(['PainFrequency', 'painFrequency', 'S']),
      secondaryParts: getString(['SecondaryParts', 'secondaryParts', 'Secondary', 'T']),
      history: getString(['History', 'history', 'U']),
      soapText: getString(['SoapText', 'soapText', 'SOAP', 'V']),
      chronicityLevel: getString(['ChronicityLevel', 'chronicityLevel', 'Chronicity', 'W']),
      recentWorse: getString(['RecentWorse', 'recentWorse', 'X']),
      mode: getString(['Mode', 'mode', 'Y']),
      includeIE: record['includeIE'] ?? record['IncludeIE'] ?? getString(['IncludeIE', 'includeIE', 'Z']),
      seed: (() => { const v = record['seed'] ?? record['Seed']; return v != null ? parseInt(String(v)) || undefined : undefined })(),
    }
  })
}

export interface ParsedExcelResult {
  readonly patients: BatchPatient[]
  readonly summary: {
    readonly totalPatients: number
    readonly totalVisits: number
    readonly byType: Record<string, number>
  }
}

/**
 * 将 Excel 行数据转换为患者列表
 * 每行 = 一个患者，自动展开为 1 IE + (totalVisits-1) TX
 */
export function buildPatientsFromRows(rows: ExcelRow[], mode: BatchMode = 'full'): ParsedExcelResult {
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    const rowMode = (row.mode === 'soap-only' || row.mode === 'continue' || row.mode === 'full') ? row.mode : mode

    if (!row.patient) errors.push(`Row ${rowNum}: Patient is required`)
    if (!row.gender || !['M', 'F'].includes(row.gender)) errors.push(`Row ${rowNum}: Gender must be M or F`)
    if (!VALID_INSURANCE.has(row.insurance)) errors.push(`Row ${rowNum}: Invalid insurance "${row.insurance}"`)
    const rowIncludeIE = parseIncludeIE(row.includeIE, rowMode)
    if (rowIncludeIE && !row.icd) errors.push(`Row ${rowNum}: ICD codes are required when IE is included`)
    if (rowMode === 'continue' && !row.soapText) errors.push(`Row ${rowNum}: SoapText is required for continue mode`)
    if (row.totalVisits < 1) errors.push(`Row ${rowNum}: TotalVisits must be at least 1`)
  }

  if (errors.length > 0) {
    throw new Error(`Excel validation errors:\n${errors.join('\n')}`)
  }

  const byType: Record<string, number> = {}
  let totalVisitCount = 0

  const patients: BatchPatient[] = rows.map(row => {
    const { name, dob } = parsePatientNameDOB(row.patient)
    const age = calculateAge(dob)
    const gender: 'Male' | 'Female' = row.gender === 'M' ? 'Male' : 'Female'
    const insurance = row.insurance as InsuranceType
    const rowMode: BatchMode = (row.mode === 'soap-only' || row.mode === 'continue' || row.mode === 'full') ? row.mode : mode

    // ── Continue mode: extract from SOAP text ──
    if (rowMode === 'continue') {
      const extracted = extractStateFromTX(row.soapText)
      const bodyPart = extracted.bodyPart
      const laterality = extracted.laterality
      const totalVisits = row.totalVisits

      const clinical: BatchPatientClinical = {
        painWorst: Math.min(10, extracted.painScale + 2),
        painBest: Math.max(1, extracted.painScale - 3),
        painCurrent: extracted.painScale,
        severityLevel: severityFromPain(extracted.painScale),
        symptomDuration: extracted.symptomDuration,
        painRadiation: extracted.painRadiation,
        painTypes: extracted.painTypes,
        associatedSymptoms: [extracted.associatedSymptom],
        causativeFactors: extracted.causativeFactors,
        relievingFactors: extracted.relievingFactors,
        symptomScale: extracted.symptomScale,
        painFrequency: parsePainFrequency(''),
        chronicityLevel: parseChronicityLevel(row.chronicityLevel),
        recentWorse: parseRecentWorse(row.recentWorse),
      }

      const icdCodes = row.icd.trim()
        ? row.icd.split(',').filter(c => c.trim()).map(code => ({ code: code.trim(), name: getICDName(code.trim()) }))
        : []

      const cptCodes: CPTWithUnits[] = row.cpt.trim()
        ? parseCPTString(row.cpt)
        : [...getDefaultTXCPT(insurance)]

      const history = row.history
        ? row.history.split(',').map(h => h.trim()).filter(h => h && h.toUpperCase() !== 'N/A')
        : []

      const visits: BatchVisit[] = []
      for (let txIdx = 0; txIdx < totalVisits; txIdx++) {
        visits.push({
          index: txIdx,
          dos: txIdx + 1,
          noteType: 'TX',
          txNumber: txIdx + 1,
          bodyPart,
          laterality,
          secondaryParts: [],
          history,
          icdCodes,
          cptCodes,
          generated: null,
          status: 'pending',
        })
        byType['TX'] = (byType['TX'] ?? 0) + 1
      }

      totalVisitCount += totalVisits

      return {
        name, dob, age, gender, insurance, clinical, visits,
        soapText: row.soapText,
        mode: rowMode,
        seed: row.seed,
      }
    }

    // ── Full / soap-only mode ──
    const bodyPart = normalizeBodyPart(row.bodyPart)
    const laterality = VALID_LATERALITY.get(row.laterality) ?? 'bilateral'

    // Parse clinical fields
    const painWorst = parsePainValue(row.painWorst, 8)
    const painBest = parsePainValue(row.painBest, 3)
    const painCurrent = parsePainValue(row.painCurrent, 6)
    const symptomDuration = parseSymptomDuration(row.symptomDuration)
    const painRadiation = row.painRadiation || 'without radiation'
    const painTypes = row.painTypes ? parseCSV(row.painTypes) : ['Dull', 'Aching']
    const associatedSymptoms = row.associatedSymptoms ? parseCSV(row.associatedSymptoms) : ['soreness']
    const causativeFactors = row.causativeFactors ? parseCSV(row.causativeFactors) : ['age related/degenerative changes']
    const relievingFactors = row.relievingFactors ? parseCSV(row.relievingFactors) : ['Changing positions', 'Resting', 'Massage']
    const symptomScale = row.symptomScale || '70%-80%'
    const painFrequency = parsePainFrequency(row.painFrequency)

    const clinical: BatchPatientClinical = {
      painWorst,
      painBest,
      painCurrent,
      severityLevel: severityFromPain(painCurrent),
      symptomDuration,
      painRadiation,
      painTypes,
      associatedSymptoms,
      causativeFactors,
      relievingFactors,
      symptomScale,
      painFrequency,
      chronicityLevel: parseChronicityLevel(row.chronicityLevel),
      recentWorse: parseRecentWorse(row.recentWorse),
    }

    // Parse shared visit fields
    const icdCodes = row.icd.trim()
      ? row.icd.split(',').filter(c => c.trim()).map(code => ({
          code: code.trim(),
          name: getICDName(code.trim()),
        }))
      : []

    const secondaryParts = row.secondaryParts
      ? row.secondaryParts.split(',').filter(p => p.trim()).map(p => normalizeBodyPart(p.trim()))
      : []

    const history = row.history
      ? row.history.split(',').map(h => h.trim()).filter(h => h && h.toUpperCase() !== 'N/A')
      : []

    // Build visits based on rowMode + includeIE
    const totalVisits = row.totalVisits
    const visits: BatchVisit[] = []

    // Determine whether to include IE visit (user-controlled, fallback: full=true, others=false)
    const includeIE = parseIncludeIE(row.includeIE, rowMode)

    if (includeIE) {
      // IE visit (dos=1) — mode-aware CPT: full adds 99203 for HF/VC, soap-only does not
      const baseCPT: CPTWithUnits[] = row.cpt.trim()
        ? parseCPTString(row.cpt).filter(c => c.code !== '99203')
        : [...getDefaultTXCPT(insurance)]
      const ieCPT: CPTWithUnits[] = rowMode === 'full'
        ? [...baseCPT, ...getDefaultIECPT(insurance)]
        : baseCPT

      visits.push({
        index: 0,
        dos: 1,
        noteType: 'IE',
        txNumber: null,
        bodyPart,
        laterality,
        secondaryParts,
        history,
        icdCodes,
        cptCodes: ieCPT,
        generated: null,
        status: 'pending',
      })
      byType['IE'] = (byType['IE'] ?? 0) + 1
    }

    // TX visits
    const txCount = includeIE ? totalVisits - 1 : totalVisits
    for (let txIdx = 0; txIdx < txCount; txIdx++) {
      const txCPT: CPTWithUnits[] = row.cpt.trim()
        ? parseCPTString(row.cpt).filter(c => c.code !== '99203')
        : [...getDefaultTXCPT(insurance)]

      const offset = includeIE ? 1 : 0
      visits.push({
        index: txIdx + offset,
        dos: txIdx + offset + 1,
        noteType: 'TX',
        txNumber: txIdx + 1,
        bodyPart,
        laterality,
        secondaryParts,
        history,
        icdCodes,
        cptCodes: txCPT,
        generated: null,
        status: 'pending',
      })
      byType['TX'] = (byType['TX'] ?? 0) + 1
    }

    totalVisitCount += totalVisits

    return {
      name,
      dob,
      age,
      gender,
      insurance,
      clinical,
      visits,
      mode: rowMode,
      seed: row.seed,
    }
  })

  return {
    patients,
    summary: {
      totalPatients: patients.length,
      totalVisits: totalVisitCount,
      byType,
    },
  }
}

/**
 * @deprecated Use buildPatientsFromRows instead
 */
export const groupAndNumberVisits = buildPatientsFromRows
