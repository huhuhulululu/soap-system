/**
 * Excel 解析器
 *
 * 解析上传的 Excel 文件 → 患者分组 → TX 自动编号
 * 根据计划 Section 3 的模板列定义
 */

import * as XLSX from 'xlsx'
import type { BodyPart, InsuranceType, Laterality, NoteType } from '../../src/types'
import type { ExcelRow, BatchPatient, BatchVisit } from '../types'
import { getICDName } from '../../src/shared/icd-catalog'
import { parseCPTString, getDefaultTXCPT, type CPTWithUnits } from '../../src/shared/cpt-catalog'

const VALID_INSURANCE = new Set<string>(['HF', 'OPTUM', 'WC', 'VC', 'ELDERPLAN', 'NONE'])
const VALID_NOTE_TYPES = new Set<string>(['IE', 'TX', 'RE'])
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
 * 解析 Excel Buffer 为原始行数据
 */
export function parseExcelBuffer(buffer: Buffer): ExcelRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Excel file has no sheets')

  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  if (rawRows.length === 0) throw new Error('Excel file has no data rows')

  return rawRows.map((row, idx) => {
    const getString = (keys: string[]): string => {
      for (const k of keys) {
        const val = row[k]
        if (val !== undefined && val !== null && val !== '') return String(val).trim()
      }
      return ''
    }
    const getNumber = (keys: string[]): number => {
      const s = getString(keys)
      const n = parseInt(s, 10)
      if (isNaN(n)) throw new Error(`Row ${idx + 2}: Invalid number in column ${keys[0]}`)
      return n
    }

    return {
      dos: getNumber(['DOS', 'dos', 'A']),
      patient: getString(['Patient', 'patient', 'B']),
      gender: getString(['Gender', 'gender', 'C']).toUpperCase() as 'M' | 'F',
      insurance: getString(['Insurance', 'insurance', 'Ins', 'D']).toUpperCase(),
      bodyPart: getString(['BodyPart', 'bodyPart', 'Body', 'E']).toUpperCase(),
      laterality: getString(['Laterality', 'laterality', 'Side', 'F']).toUpperCase(),
      noteType: getString(['NoteType', 'noteType', 'Type', 'G']).toUpperCase(),
      icd: getString(['ICD', 'icd', 'H']),
      cpt: getString(['CPT', 'cpt', 'I']),
      secondaryParts: getString(['SecondaryParts', 'secondaryParts', 'Secondary', 'J']),
      history: getString(['History', 'history', 'K']),
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
 * 将原始行数据分组为患者 + visits，自动编号 TX
 */
export function groupAndNumberVisits(rows: ExcelRow[]): ParsedExcelResult {
  const errors: string[] = []

  // 验证基本字段
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    if (!row.patient) errors.push(`Row ${rowNum}: Patient is required`)
    if (!row.gender || !['M', 'F'].includes(row.gender)) errors.push(`Row ${rowNum}: Gender must be M or F`)
    if (!VALID_INSURANCE.has(row.insurance)) errors.push(`Row ${rowNum}: Invalid insurance "${row.insurance}"`)
    if (!VALID_NOTE_TYPES.has(row.noteType)) errors.push(`Row ${rowNum}: Invalid note type "${row.noteType}"`)
  }

  if (errors.length > 0) {
    throw new Error(`Excel validation errors:\n${errors.join('\n')}`)
  }

  // 按 Patient (Name+DOB) 分组
  const patientMap = new Map<string, { rows: Array<{ row: ExcelRow; idx: number }> }>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const key = row.patient
    const existing = patientMap.get(key)
    if (existing) {
      existing.rows.push({ row, idx: i })
    } else {
      patientMap.set(key, { rows: [{ row, idx: i }] })
    }
  }

  const byType: Record<string, number> = {}
  const patients: BatchPatient[] = []

  for (const [patientKey, { rows: patientRows }] of patientMap) {
    // 按 DOS 排序
    const sorted = [...patientRows].sort((a, b) => a.row.dos - b.row.dos)

    const firstRow = sorted[0].row
    const { name, dob } = parsePatientNameDOB(patientKey)
    const age = calculateAge(dob)
    const gender: 'Male' | 'Female' = firstRow.gender === 'M' ? 'Male' : 'Female'
    const insurance = firstRow.insurance as InsuranceType

    // ICD 继承逻辑
    let lastICD: string = ''
    // TX 编号
    let txCounter = 0

    const visits: BatchVisit[] = sorted.map((item, visitIdx) => {
      const row = item.row
      const noteType = row.noteType as NoteType

      // ICD: 继承上一行
      const icdRaw = row.icd || lastICD
      if (visitIdx === 0 && !icdRaw) {
        throw new Error(`Patient "${patientKey}": first visit must have ICD codes`)
      }
      if (icdRaw) lastICD = icdRaw

      const icdCodes = icdRaw.split(',').filter(c => c.trim()).map(code => ({
        code: code.trim(),
        name: getICDName(code.trim()),
      }))

      // TX 编号
      let txNumber: number | null = null
      if (noteType === 'TX') {
        txCounter++
        txNumber = txCounter
      }

      // CPT: 用户指定 或 按保险自动推断 (TX only)
      let cptCodes: CPTWithUnits[]
      if (row.cpt.trim()) {
        cptCodes = parseCPTString(row.cpt)
      } else if (noteType === 'TX') {
        cptCodes = [...getDefaultTXCPT(insurance)]
      } else {
        cptCodes = []
      }

      // BodyPart & Laterality
      const bodyPart = normalizeBodyPart(row.bodyPart)
      const laterality = VALID_LATERALITY.get(row.laterality) ?? 'bilateral'

      // Secondary parts
      const secondaryParts = row.secondaryParts
        ? row.secondaryParts.split(',').filter(p => p.trim()).map(p => normalizeBodyPart(p.trim()))
        : []

      // History
      const history = row.history
        ? row.history.split(',').map(h => h.trim()).filter(Boolean)
        : []

      // Count by type
      byType[noteType] = (byType[noteType] ?? 0) + 1

      return {
        index: visitIdx,
        dos: row.dos,
        noteType,
        txNumber,
        bodyPart,
        laterality,
        secondaryParts,
        history,
        icdCodes,
        cptCodes,
        generated: null,
        status: 'pending' as const,
      }
    })

    patients.push({
      name,
      dob,
      age,
      gender,
      insurance,
      visits,
    })
  }

  return {
    patients,
    summary: {
      totalPatients: patients.length,
      totalVisits: rows.length,
      byType,
    },
  }
}
