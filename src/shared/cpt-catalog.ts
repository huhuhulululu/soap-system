/**
 * CPT Code → Name 映射表
 *
 * 针灸科常用 CPT 码的标准名称映射。
 * 用于批量自动化时传递给 MDLand addSelectionD_cpt(fullText, newText, newCode)。
 *
 * 数据来源: MDLand AJAX 搜索 API 实测验证
 */

import type { InsuranceType } from '../types'

export interface CPTEntry {
  readonly code: string
  readonly name: string
  readonly hasElectricalStimulation: boolean
}

const CPT_ENTRIES: readonly CPTEntry[] = [
  { code: '97810', name: 'ACUP 1/> WO ESTIM 1ST 15 MIN', hasElectricalStimulation: false },
  { code: '97811', name: 'ACUP 1/> W/O ESTIM EA ADD 15', hasElectricalStimulation: false },
  { code: '97813', name: 'ACUP 1/> W/ESTIM 1ST 15 MIN', hasElectricalStimulation: true },
  { code: '97814', name: 'ACUP 1/> W/ESTIM EA ADDL 15', hasElectricalStimulation: true },
  { code: '97140', name: 'MANUAL THERAPY 1/> REGIONS', hasElectricalStimulation: false },
  { code: '97161', name: 'PT EVAL LOW COMPLEX 20 MIN', hasElectricalStimulation: false },
  { code: '97162', name: 'PT EVAL MOD COMPLEX 30 MIN', hasElectricalStimulation: false },
  { code: '97163', name: 'PT EVAL HIGH COMPLEX 45 MIN', hasElectricalStimulation: false },
  { code: '99203', name: 'OFFICE O/P NEW LOW 30 MIN', hasElectricalStimulation: false },
  { code: '99212', name: 'OFFICE O/P EST SF 10 MIN', hasElectricalStimulation: false },
  { code: '99213', name: 'OFFICE O/P EST LOW 20 MIN', hasElectricalStimulation: false },
] as const

/**
 * CPT code → name 快速查找映射
 */
const CODE_TO_NAME = new Map<string, string>(
  CPT_ENTRIES.map(e => [e.code, e.name])
)

/**
 * 根据 CPT code 获取标准名称
 * 未找到时返回 code 本身
 */
export function getCPTName(code: string): string {
  return CODE_TO_NAME.get(code) ?? code
}

/**
 * 获取完整 CPT 条目
 */
export function getCPTEntry(code: string): CPTEntry | undefined {
  return CPT_ENTRIES.find(e => e.code === code)
}

/**
 * 获取所有 CPT 条目
 */
export function getAllCPTEntries(): readonly CPTEntry[] {
  return CPT_ENTRIES
}

export interface CPTWithUnits {
  readonly code: string
  readonly name: string
  readonly units: number
}

/**
 * 保险类型 → 默认 TX CPT 组合
 */
const INSURANCE_DEFAULT_CPT: Record<InsuranceType, readonly CPTWithUnits[]> = {
  HF: [{ code: '97810', name: 'ACUP 1/> WO ESTIM 1ST 15 MIN', units: 1 }],
  OPTUM: [{ code: '97810', name: 'ACUP 1/> WO ESTIM 1ST 15 MIN', units: 1 }],
  WC: [
    { code: '97813', name: 'ACUP 1/> W/ESTIM 1ST 15 MIN', units: 1 },
    { code: '97814', name: 'ACUP 1/> W/ESTIM EA ADDL 15', units: 2 },
    { code: '97811', name: 'ACUP 1/> W/O ESTIM EA ADD 15', units: 1 },
  ],
  VC: [
    { code: '97813', name: 'ACUP 1/> W/ESTIM 1ST 15 MIN', units: 1 },
    { code: '97814', name: 'ACUP 1/> W/ESTIM EA ADDL 15', units: 1 },
    { code: '97811', name: 'ACUP 1/> W/O ESTIM EA ADD 15', units: 2 },
  ],
  ELDERPLAN: [{ code: '97810', name: 'ACUP 1/> WO ESTIM 1ST 15 MIN', units: 1 }],
  NONE: [{ code: '97810', name: 'ACUP 1/> WO ESTIM 1ST 15 MIN', units: 1 }],
}

/**
 * 获取保险类型对应的默认 TX CPT 组合
 */
export function getDefaultTXCPT(insurance: InsuranceType): readonly CPTWithUnits[] {
  return INSURANCE_DEFAULT_CPT[insurance] ?? INSURANCE_DEFAULT_CPT.NONE
}

/**
 * 保险类型 → 默认 IE CPT（首诊）
 * HF/VC: 99203 (Modifier 25 已内置于 MDLand 选项)
 */
const INSURANCE_IE_CPT: Partial<Record<InsuranceType, readonly CPTWithUnits[]>> = {
  HF: [{ code: '99203', name: 'OFFICE O/P NEW LOW 30 MIN', units: 1 }],
  VC: [{ code: '99203', name: 'OFFICE O/P NEW LOW 30 MIN', units: 1 }],
}

export function getDefaultIECPT(insurance: InsuranceType): readonly CPTWithUnits[] {
  return INSURANCE_IE_CPT[insurance] ?? []
}

/**
 * 解析 CPT 字符串 (如 "97810,97811x3,97140x2")
 * 返回 CPTWithUnits 数组
 */
export function parseCPTString(cptStr: string): CPTWithUnits[] {
  if (!cptStr.trim()) return []

  return cptStr.split(',').map(part => {
    const trimmed = part.trim()
    const match = trimmed.match(/^(\d+)(?:x(\d+))?$/)
    if (!match) {
      throw new Error(`Invalid CPT format: "${trimmed}". Expected format: 97810 or 97810x3`)
    }
    const code = match[1]
    const units = match[2] ? parseInt(match[2], 10) : 1
    return {
      code,
      name: getCPTName(code),
      units,
    }
  })
}
