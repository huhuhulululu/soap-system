/**
 * 动态 Goals 计算器
 * 基于康复曲线理论，与 tx-sequence-engine 的 progress 对齐
 */
import type { SeverityLevel, BodyPart } from '../types'

export interface DynamicGoals {
  pain: { st: string; lt: string }
  symptomType: string  // 'soreness', 'weakness', 'stiffness', 'heaviness', 'numbness'
  symptomPct: { st: string; lt: string }  // 症状百分比 (原 soreness)
  tightness: { st: string; lt: string }
  tenderness: { st: number; lt: number }
  spasm: { st: number; lt: number }
  strength: { st: string; lt: string }
  rom: { st: string; lt: string }
  adl: { st: string; lt: string }
}

export interface IEPainScale {
  worst: string
  best: string
  current: string
}

// ===== 康复曲线核心函数 =====

/** Ease-out quadratic: 前期快速改善，后期缓慢 */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

/** 康复曲线计算 */
function recoveryCurve(initial: number, target: number, progress: number): number {
  return initial - (initial - target) * easeOutQuad(progress)
}

/** 吸附到模板 dropdown 网格 */
function snapToGrid(value: number): string {
  const floor = Math.floor(value)
  const frac = value - floor
  if (frac >= 0.75) return String(Math.min(10, floor + 1))
  if (frac >= 0.25) return `${Math.min(10, floor + 1)}-${floor}`
  return String(floor)
}

// ===== Pain Scale 映射 =====

const IE_PAIN_SCALE: Record<string, Record<string, IEPainScale>> = {
  SHOULDER: {
    'severe': { worst: '9', best: '7', current: '9-8' },
    'moderate to severe': { worst: '7', best: '6', current: '7-6' },
    'moderate': { worst: '7', best: '5', current: '6-5' },
    'mild to moderate': { worst: '6', best: '4', current: '5-4' },
    'mild': { worst: '4', best: '3', current: '4-3' },
  },
  DEFAULT: {
    'severe': { worst: '10', best: '7', current: '10-9' },
    'moderate to severe': { worst: '8', best: '6', current: '8' },
    'moderate': { worst: '7', best: '5', current: '7-6' },
    'mild to moderate': { worst: '6', best: '4', current: '5-4' },
    'mild': { worst: '4', best: '3', current: '4-3' },
  }
}

// ===== Goals 计算常量 =====

const TIGHTNESS_LEVELS = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
const MAIN_BODY_PARTS: BodyPart[] = ['KNEE', 'SHOULDER', 'LBP', 'NECK']

// ST Goal 进度位置 (0.55 使 Pain 8 → ST 4)
const ST_PROGRESS = 0.55
// LT Goal = 初始值 * 此比率 (0.25 使 Pain 8 → LT 2)
const OPTIMAL_END_RATIO = 0.25

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

/** 计算 Pain Goals (基于康复曲线) */
function calculatePainGoals(painCurrent: number, bp: BodyPart): { st: string; lt: string } {
  // 边界: 已经很好
  if (painCurrent <= 3) {
    return { st: '1', lt: '1' }
  }
  // 轻中度: 积极目标
  if (painCurrent <= 6) {
    return { st: '2', lt: '1' }
  }

  // 正常: 重症 (Pain >= 7)
  const optimalEnd = Math.max(2, painCurrent * OPTIMAL_END_RATIO)
  const stActual = recoveryCurve(painCurrent, optimalEnd, ST_PROGRESS)
  const stTarget = Math.ceil(stActual)
  const ltTarget = Math.ceil(optimalEnd)

  // ST Goal 格式: 降幅 2-3 级用范围格式
  const delta = painCurrent - stTarget
  const painST = (delta >= 2 && delta <= 4 && stTarget >= 4)
    ? `${stTarget}-${stTarget + 1}`
    : snapToGrid(stTarget)

  // LT Goal 格式: 使用范围格式 (如 "2-3")
  const painLT = ltTarget <= 3 ? `${ltTarget}-${ltTarget + 1}` : String(ltTarget)

  return { st: painST, lt: painLT }
}

/** 计算 Tightness Goals */
function calculateTightnessGoals(severity: SeverityLevel): { st: string; lt: string } {
  const idx = TIGHTNESS_LEVELS.indexOf(severity)
  const current = idx >= 0 ? idx : 3
  // 边界: 已经很好
  if (current <= 1) return { st: TIGHTNESS_LEVELS[current], lt: TIGHTNESS_LEVELS[0] }
  // 正常: ST 降 1 档, LT 降 3 档 (拉大差距)
  return {
    st: TIGHTNESS_LEVELS[Math.max(0, current - 1)],
    lt: TIGHTNESS_LEVELS[Math.max(0, current - 3)]
  }
}

/** 计算 Tenderness Goals */
function calculateTendernessGoals(severity: SeverityLevel, bp: BodyPart): { st: number; lt: number } {
  const map: Record<string, number> = {
    'severe': 4, 'moderate to severe': 4, 'moderate': 3, 'mild to moderate': 2, 'mild': 1
  }
  const current = map[severity] ?? 3
  // 边界: 已最优
  if (current <= 1) return { st: 1, lt: 1 }
  // ST 降 1 级, LT 降到 1-2 (拉大差距)
  return {
    st: Math.max(1, current - 1),
    lt: Math.max(1, current - 3)
  }
}

/** 计算 Spasm Goals */
function calculateSpasmGoals(current: number = 3): { st: number; lt: number } {
  if (current <= 1) return { st: 1, lt: 0 }
  // ST 降 1 级, LT 降到 0-1 (拉大差距)
  return { st: Math.max(1, current - 1), lt: Math.max(0, current - 3) }
}

/** 计算 Strength Goals (与 ROM 关联) */
function calculateStrengthGoals(current: string = '3+/5'): { st: string; lt: string } {
  const map: Record<string, number> = {
    '0/5': 0, '1/5': 1, '2/5': 2, '2+/5': 2.5, '3/5': 3, '3+/5': 3.5,
    '4-/5': 3.8, '4/5': 4, '4+/5': 4.5, '5/5': 5
  }
  const val = map[current] ?? 3.5
  // 边界: 已接近满分
  if (val >= 4.5) return { st: '4+', lt: '4+' }
  if (val >= 4) return { st: '4', lt: '4+' }
  // ST +0.5, LT +1.0 (ROM 改善后才能训练)
  const stVal = Math.min(5, val + 0.5)
  const ltVal = Math.min(5, val + 1.0)
  const format = (v: number) => v >= 4.5 ? '4+' : v >= 4 ? '4' : v >= 3.5 ? '3+' : '3'
  return { st: format(stVal), lt: format(ltVal) }
}

/** 计算症状百分比 Goals (原 Soreness，现支持多种症状类型) */
function calculateSymptomPctGoals(severity: SeverityLevel): { st: string; lt: string } {
  // 症状百分比与 Pain/Severity 正相关
  const map: Record<string, { st: string; lt: string }> = {
    'severe': { st: '(60%-70%)', lt: '(30%-40%)' },
    'moderate to severe': { st: '(50%-60%)', lt: '(20%-30%)' },
    'moderate': { st: '(40%-50%)', lt: '(20%-30%)' },
    'mild to moderate': { st: '(30%-40%)', lt: '(10%-20%)' },
    'mild': { st: '(20%-30%)', lt: '(10%-20%)' },
  }
  return map[severity] || { st: '(50%-60%)', lt: '(20%-30%)' }
}
function calculateROMGoals(severity: SeverityLevel): { st: string; lt: string } {
  // ROM 改善依赖 Tightness 改善
  // severe: 50% → ST 70% → LT 85%
  // mod-sev: 60% → ST 80% → LT 92%
  // moderate: 70% → ST 85% → LT 95%
  const map: Record<string, { st: string; lt: string }> = {
    'severe': { st: '50%', lt: '70%' },
    'moderate to severe': { st: '60%', lt: '80%' },
    'moderate': { st: '50%', lt: '60%' },
    'mild to moderate': { st: '50%', lt: '60%' },
    'mild': { st: '50%', lt: '60%' },
  }
  return map[severity] || { st: '60%', lt: '80%' }
}

/** 计算 ADL Goals (与 Tightness 同步) */
function calculateADLGoals(severity: SeverityLevel): { st: string; lt: string } {
  // ADL 与 Tightness 同步，使用连字符格式
  const tightness = calculateTightnessGoals(severity)
  return {
    st: tightness.st.replace(/ to /g, '-'),
    lt: tightness.lt.replace(/ to /g, '-')
  }
}

/**
 * @param severity - ADL severity level
 * @param bp - body part
 * @param symptomType - associated symptom type
 * @param painOverride - 用户实际 pain 值 (可选，优先于 severity 反推)
 */
export function calculateDynamicGoals(severity: SeverityLevel, bp: BodyPart, symptomType: string = 'soreness', painOverride?: number): DynamicGoals {
  const painCurrent = painOverride ?? parsePainFromSeverity(severity)

  return {
    pain: calculatePainGoals(painCurrent, bp),
    symptomType: symptomType,
    symptomPct: calculateSymptomPctGoals(severity),
    tightness: calculateTightnessGoals(severity),
    tenderness: calculateTendernessGoals(severity, bp),
    spasm: calculateSpasmGoals(3), // IE 默认 spasm=+3，正确
    // 从 severity 推导初始 strength，避免硬编码
    strength: calculateStrengthGoals(
      severity === 'severe' || severity === 'moderate to severe' ? '4-/5'
        : severity === 'moderate' ? '4/5'
          : '4+/5'
    ),
    rom: calculateROMGoals(severity),
    adl: calculateADLGoals(severity),
  }
}
