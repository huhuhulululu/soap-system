/**
 * 动态 Goals 计算器
 * 纯函数：输入 severity + bodyPart，输出动态 Goals 值和 IE Pain Scale
 */
import type { SeverityLevel, BodyPart } from '../types'

export interface DynamicGoals {
  pain:       { st: string; lt: string }
  soreness:   { st: string; lt: string }
  tightness:  { st: string; lt: string }
  tenderness: { st: number; lt: number }
  spasm:      { st: number; lt: number }
  strength:   { st: string; lt: string }
}

export interface IEPainScale {
  worst: string
  best: string
  current: string
}

// ===== Pain Scale 映射（与 tx-sequence-engine severityFromPain 反向对齐）=====

const IE_PAIN_SCALE: Record<string, Record<string, IEPainScale>> = {
  SHOULDER: {
    'severe':             { worst: '9',  best: '7', current: '9-8' },
    'moderate to severe': { worst: '7',  best: '6', current: '7-6' },
    'moderate':           { worst: '7',  best: '5', current: '6-5' },
    'mild to moderate':   { worst: '6',  best: '4', current: '5-4' },
    'mild':               { worst: '4',  best: '3', current: '4-3' },
  },
  DEFAULT: {
    'severe':             { worst: '10', best: '7', current: '10-9' },
    'moderate to severe': { worst: '8',  best: '6', current: '8' },
    'moderate':           { worst: '7',  best: '5', current: '7-6' },
    'mild to moderate':   { worst: '6',  best: '4', current: '5-4' },
    'mild':               { worst: '4',  best: '3', current: '4-3' },
  }
}

// ===== Goals 计算常量 =====

const SEVERITY_TO_TENDER: Record<string, number> = {
  'severe': 4, 'moderate to severe': 3, 'moderate': 3, 'mild to moderate': 2, 'mild': 1
}

const TIGHTNESS_LEVELS = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']

const IE_SPASM = 3 // generateObjective 固定值

const MAIN_BODY_PARTS: BodyPart[] = ['KNEE', 'SHOULDER', 'LBP', 'NECK']

// ===== 导出函数 =====

export function parsePainFromSeverity(severity: SeverityLevel): number {
  const map: Record<string, number> = {
    'severe': 10, 'moderate to severe': 8, 'moderate': 7, 'mild to moderate': 5, 'mild': 4
  }
  return map[severity] ?? 8
}

export function calculateIEPainScale(severity: SeverityLevel, bp: BodyPart): IEPainScale {
  const table = IE_PAIN_SCALE[bp] || IE_PAIN_SCALE['DEFAULT']
  return table[severity] || table['moderate to severe']
}

export function calculateDynamicGoals(severity: SeverityLevel, bp: BodyPart): DynamicGoals {
  const painCurrent = parsePainFromSeverity(severity)
  const isMainBP = MAIN_BODY_PARTS.includes(bp)

  // Pain: 重症降 3 级范围，轻症维持
  let painST: string
  let painLT: string
  if (painCurrent <= 4) {
    painST = String(painCurrent)
    painLT = String(Math.max(2, painCurrent - 1))
  } else if (painCurrent <= 6) {
    painST = String(painCurrent)
    painLT = String(Math.max(2, painCurrent - 2))
  } else {
    painST = `${painCurrent - 3}-${painCurrent - 2}`
    painLT = String(Math.max(3, painCurrent - 5))
  }
  // SHOULDER LT 用范围格式
  if (bp === 'SHOULDER' && painCurrent >= 7) {
    const ltBase = Math.max(3, painCurrent - 5)
    painLT = `${ltBase}-${ltBase + 1}`
  }

  // Tenderness: ST=当前级别, LT 降 1-2 级
  // 主要部位: LT 降 1 级; 其他部位: LT 降 2 级
  const tenderCurrent = SEVERITY_TO_TENDER[severity] || 3
  const tenderST = tenderCurrent
  const tenderLT = isMainBP
    ? Math.max(1, tenderCurrent - 1)
    : Math.max(1, tenderCurrent - 2)

  // Tightness: ST 降 1 档, LT 降 2 档
  const tightIdx = TIGHTNESS_LEVELS.indexOf(severity)
  const tightCurrent = tightIdx >= 0 ? tightIdx : 3
  const tightSTIdx = Math.max(0, tightCurrent - 1)
  const tightLTIdx = Math.max(0, tightCurrent - 2)

  // Spasm: 固定 +3 起点
  const spasmST = Math.max(1, IE_SPASM - 1)
  const spasmLT = Math.max(0, IE_SPASM - 2)

  return {
    pain:       { st: painST, lt: painLT },
    soreness:   { st: '(70%-80%)', lt: '(70%-80%)' },
    tightness:  { st: TIGHTNESS_LEVELS[tightSTIdx], lt: TIGHTNESS_LEVELS[tightLTIdx] },
    tenderness: { st: tenderST, lt: tenderLT },
    spasm:      { st: spasmST, lt: spasmLT },
    strength:   { st: '4', lt: '4+' },
  }
}
