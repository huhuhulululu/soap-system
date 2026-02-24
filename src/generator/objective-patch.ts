/**
 * Objective 补丁模块 — 修正 Strength/ROM 评分
 *
 * 独立模块，不修改任何现有文件。
 * 作为文本后处理器，在 exportSOAPAsText 生成文本后应用。
 *
 * 修正内容：
 * 1. romLimitFactor 曲线更陡峭（pain 8 → 0.52 而非 0.77）
 * 2. strength base grades 更低（pain 8 → 3/5 而非 4-/5）
 * 3. 去掉 HARD difficulty 降级，改用 painSensitivity 产生差异
 * 4. baselineCondition / chronicityLevel 影响 strength
 * 5. TX ROM pain offset 从 2.8 降到 1.4
 * 6. TX bumpStrength 阈值调整
 * 7. IE Spasm 去硬编码
 */

import {
  BODY_PART_ROM,
  type ROMMovement,
  type ROMDifficulty,
} from '../shared/body-part-constants'
import {
  inferProgressMultiplier,
  inferInitialAdjustments,
} from '../knowledge/medical-history-engine'
import type { GenerationContext, SeverityLevel, BodyPart } from '../types'

// ==================== 修正公式 ====================

/**
 * 修正后的 ROM 受限因子
 * 比原版更陡峭：pain 8 → 0.52（原 0.77）
 */
function patchedRomLimitFactor(painLevel: number): number {
  const breakpoints = [
    { pain: 0, factor: 1.00 },
    { pain: 2, factor: 0.93 },
    { pain: 4, factor: 0.82 },
    { pain: 6, factor: 0.68 },
    { pain: 8, factor: 0.52 },
    { pain: 10, factor: 0.35 },
  ]

  const p = Math.max(0, Math.min(10, painLevel))
  if (p <= breakpoints[0].pain) return breakpoints[0].factor
  if (p >= breakpoints[breakpoints.length - 1].pain) return breakpoints[breakpoints.length - 1].factor

  for (let i = 0; i < breakpoints.length - 1; i++) {
    const lo = breakpoints[i]
    const hi = breakpoints[i + 1]
    if (p >= lo.pain && p <= hi.pain) {
      const t = (p - lo.pain) / (hi.pain - lo.pain)
      return lo.factor + t * (hi.factor - lo.factor)
    }
  }
  return 0.68
}

/**
 * 修正后的肌力等级
 * pain 8 → 3/5（原 4-/5），无 HARD 降级
 */
const PATCHED_BASE_GRADES: readonly string[] = [
  '5/5',   // pain 0
  '4+/5',  // pain 1
  '4+/5',  // pain 2
  '4/5',   // pain 3
  '4/5',   // pain 4
  '4-/5',  // pain 5
  '4-/5',  // pain 6
  '4-/5',  // pain 7
  '3+/5',  // pain 8
  '3+/5',  // pain 9
  '3/5',   // pain 10
]

const STRENGTH_LADDER: readonly string[] = [
  '3-/5', '3/5', '3+/5', '4-/5', '4/5', '4+/5', '5/5',
]

function patchedStrength(painLevel: number): string {
  const painInt = Math.round(Math.max(0, Math.min(10, painLevel)))
  return PATCHED_BASE_GRADES[painInt]
}

/**
 * baselineCondition / chronicityLevel 修正：降一级（不叠加）
 */
function applyConditionDowngrade(
  strength: string,
  baselineCondition?: 'good' | 'fair' | 'poor',
  chronicityLevel?: string,
): string {
  const shouldDowngrade =
    baselineCondition === 'poor' || chronicityLevel === 'Chronic'
  if (!shouldDowngrade) return strength

  const idx = STRENGTH_LADDER.indexOf(strength)
  if (idx <= 0) return STRENGTH_LADDER[0]
  return STRENGTH_LADDER[idx - 1]
}

/**
 * Pain sensitivity 基于已有的 difficulty 字段
 * HARD 动作更受疼痛影响，EASY 动作较少受影响
 */
function getPainSensitivity(difficulty: ROMDifficulty): number {
  const map: Record<ROMDifficulty, number> = {
    HARD: 1.15,
    MEDIUM: 1.0,
    EASY: 0.85,
  }
  return map[difficulty]
}

function getDifficultyFactor(difficulty: ROMDifficulty): number {
  const factors: Record<ROMDifficulty, number> = { EASY: 1.0, MEDIUM: 0.9, HARD: 0.8 }
  return factors[difficulty]
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/**
 * 修正后的 ROM 角度计算
 */
function patchedRomValue(
  normalDegrees: number,
  painLevel: number,
  difficulty: ROMDifficulty,
): number {
  const limitFactor = patchedRomLimitFactor(painLevel)
  const diffFactor = getDifficultyFactor(difficulty)
  const raw = normalDegrees * limitFactor * diffFactor
  return Math.round(raw / 5) * 5
}

function calculateLimitation(romValue: number, normalRom: number): string {
  if (normalRom <= 0) return 'normal'
  const ratio = romValue / normalRom
  if (ratio >= 0.90) return 'normal'
  if (ratio >= 0.75) return 'mild'
  if (ratio >= 0.50) return 'moderate'
  return 'severe'
}

/**
 * 修正后的 bumpStrength（TX 用）
 * 阈值从 0.7/0.45 调整为 0.80/0.50
 */
function bumpStrength(strength: string, progress: number): string {
  const step = progress > 0.80 ? 2 : progress > 0.50 ? 1 : 0
  if (step === 0) return strength
  const idx = STRENGTH_LADDER.indexOf(strength)
  if (idx < 0) return strength
  // 最高只能到 4+/5（index 5），不能到 5/5
  const maxIdx = strength === '5/5' ? 6 : 5
  return STRENGTH_LADDER[Math.min(maxIdx, idx + step)]
}

/**
 * 修正后的单个 movement 计算
 */
function patchedComputeRom(
  rom: ROMMovement,
  index: number,
  sideOffset: number,
  adjustedPain: number,
  romAdjustment: number,
  progress: number | undefined,
  baselineCondition?: 'good' | 'fair' | 'poor',
  chronicityLevel?: string,
  adlImproved?: boolean,
): { strength: string; romValue: number; limitation: string } {
  // Strength: wider difficulty spread so HARD < MEDIUM < EASY, small jitter breaks ties
  const STRENGTH_SENS: Record<ROMDifficulty, number> = { HARD: 1.3, MEDIUM: 1.0, EASY: 0.7 }
  const jitter = ((index * 3 + sideOffset) % 5 - 2) * 0.3
  const strengthPain = clamp(adjustedPain * STRENGTH_SENS[rom.difficulty] + jitter, 1, 10)

  let strength = patchedStrength(strengthPain)
  strength = applyConditionDowngrade(strength, baselineCondition, chronicityLevel)

  if (progress !== undefined && progress > 0) {
    strength = bumpStrength(strength, progress)
  }

  if (adlImproved) {
    const idx = STRENGTH_LADDER.indexOf(strength)
    if (idx >= 0 && idx < STRENGTH_LADDER.length - 1) {
      strength = STRENGTH_LADDER[idx + 1]
    }
  }

  // ROM: original narrow sensitivity — degrees stay stable
  const romPain = clamp(adjustedPain * getPainSensitivity(rom.difficulty), 1, 10)
  let romValue = patchedRomValue(rom.normalDegrees, romPain, rom.difficulty)

  if (romAdjustment !== 0 && rom.normalDegrees > 0) {
    romValue = Math.max(
      Math.round(rom.normalDegrees * 0.25),
      Math.min(rom.normalDegrees, romValue + romAdjustment),
    )
    romValue = Math.round(romValue / 5) * 5
  }

  const limitation = calculateLimitation(romValue, rom.normalDegrees)
  return { strength, romValue, limitation }
}

// ==================== 文本后处理器 ====================

/**
 * Strength grade 正则：匹配行首的 "3-/5", "3/5", "3+/5", "4-/5", "4/5", "4+/5", "5/5"
 */
const STRENGTH_RE = /^(\d[+-]?\/5)\s/

/**
 * 从 Objective 文本中提取 ROM 区域的起止位置
 * ROM 区域以 "Muscles Strength and" 开头，到 "Inspection:" 或 "tongue" 之前结束
 */
function findRomBlockBounds(objectiveText: string): { start: number; end: number } | null {
  // ROM 区域标记
  const romStartPatterns = [
    /^.*Muscles Strength and (?:Spine ROM|Joint ROM).*$/m,
    /^(?:Right|Left) (?:Knee|Shoulder) Muscles Strength and Joint ROM.*$/m,
  ]

  let start = -1
  for (const pattern of romStartPatterns) {
    const match = objectiveText.match(pattern)
    if (match && match.index !== undefined) {
      if (start === -1 || match.index < start) {
        start = match.index
      }
    }
  }
  if (start === -1) return null

  // ROM 区域结束标记
  const afterRom = objectiveText.slice(start)
  const endPatterns = [/^Inspection:/m, /^tongue$/m]
  let end = objectiveText.length
  for (const pattern of endPatterns) {
    const match = afterRom.match(pattern)
    if (match && match.index !== undefined) {
      const candidate = start + match.index
      if (candidate < end) end = candidate
    }
  }

  return { start, end }
}

/**
 * 从 context 推导 IE 的 basePain
 */
function deriveBasePain(context: GenerationContext): number {
  if (context.painCurrent !== undefined) return context.painCurrent
  const severityMap: Record<string, number> = {
    'severe': 9,
    'moderate to severe': 8,
    'moderate': 6,
    'mild to moderate': 5,
    'mild': 3,
  }
  return severityMap[context.severityLevel] || 7
}

/**
 * 推导 baselineCondition（如果 context 没有提供）
 */
function deriveBaselineCondition(context: GenerationContext): 'good' | 'fair' | 'poor' {
  if (context.baselineCondition) return context.baselineCondition
  // 简化版 inferCondition 逻辑
  let score = 0
  const history = context.medicalHistory || []
  const severe = ['Stroke', 'Parkinson', 'Kidney Disease', 'Heart Disease', 'Liver Disease']
  const chronic = ['Diabetes', 'Hypertension', 'Lung Disease', 'Asthma', 'Anemia', 'Thyroid']
  score += history.filter(h => severe.includes(h)).length * 3
  score += history.filter(h => chronic.includes(h)).length
  if (context.age && context.age >= 75) score += 1.5
  else if (context.age && context.age >= 65) score += 0.5
  if (score >= 2.5) return 'poor'
  if (score >= 1) return 'fair'
  return 'good'
}

// ==================== SHOULDER / KNEE ROM 选项（从 soap-generator 复制） ====================

const SHOULDER_ABDUCTION_OPTIONS = [
  { degrees: 180, label: '180 degree(normal)' },
  { degrees: 175, label: '175 degree(normal)' },
  { degrees: 170, label: '170 degree(normal)' },
  { degrees: 165, label: '165 degree(mild)' },
  { degrees: 160, label: '160 degree(mild)' },
  { degrees: 155, label: '155 degree(mild)' },
  { degrees: 150, label: '150 degree(mild)' },
  { degrees: 145, label: '145 degree(moderate)' },
  { degrees: 140, label: '140 degree(moderate)' },
  { degrees: 135, label: '135 degree(moderate)' },
  { degrees: 130, label: '130 degree(moderate)' },
  { degrees: 125, label: '125 degree(moderate)' },
  { degrees: 120, label: '120 degree(moderate)' },
  { degrees: 115, label: '115 degree(moderate)' },
  { degrees: 110, label: '110 degree(moderate)' },
  { degrees: 105, label: '105 degree(moderate)' },
  { degrees: 100, label: '100 degree(moderate)' },
  { degrees: 95, label: '95 degree(moderate)' },
  { degrees: 90, label: '90 degree(severe)' },
  { degrees: 85, label: '85 degree(severe)' },
  { degrees: 80, label: '80 degree(severe)' },
  { degrees: 75, label: '75 degree(severe)' },
  { degrees: 70, label: '70 degree(severe)' },
  { degrees: 65, label: '65 degree(severe)' },
  { degrees: 60, label: '60 degree(severe)' },
  { degrees: 55, label: '55 degree(severe)' },
  { degrees: 50, label: '50 degree(severe)' },
  { degrees: 45, label: '45 degree(severe)' },
  { degrees: 40, label: '40 degree(severe)' },
  { degrees: 35, label: '35 degree(severe)' },
  { degrees: 30, label: '30 degree(severe)' },
  { degrees: 25, label: '25 degree(severe)' },
  { degrees: 20, label: '20 degree(severe)' },
  { degrees: 15, label: '15 degree(severe)' },
  { degrees: 10, label: '10 degree(severe)' },
  { degrees: 5, label: '5 degree(severe)' },
]

const SHOULDER_FLEXION_OPTIONS = SHOULDER_ABDUCTION_OPTIONS

const SHOULDER_HORIZONTAL_ADDUCTION_OPTIONS = [
  { degrees: 45, label: '45 degree (normal)' },
  { degrees: 40, label: '40 degree (normal)' },
  { degrees: 35, label: '35 degree (normal)' },
  { degrees: 30, label: '30 degree (normal)' },
  { degrees: 25, label: '25 degree (mild)' },
  { degrees: 20, label: '20 degree (mild)' },
  { degrees: 15, label: '15 degree (moderate)' },
  { degrees: 10, label: '10 degree (moderate)' },
  { degrees: 5, label: '5 degree (severe)' },
  { degrees: 0, label: 'can not do this at all' },
]

const SHOULDER_EXTENSION_OPTIONS = [
  { degrees: 5, label: '5 Degrees(severe)' },
  { degrees: 10, label: '10 Degrees(severe)' },
  { degrees: 15, label: '15 Degrees(severe)' },
  { degrees: 20, label: '20 Degrees(moderate)' },
  { degrees: 25, label: '25 Degrees(moderate)' },
  { degrees: 30, label: '30 Degrees(moderate)' },
  { degrees: 35, label: '35 Degrees(moderate)' },
  { degrees: 40, label: '40 Degrees(mild)' },
  { degrees: 45, label: '45 Degrees(mild)' },
  { degrees: 50, label: '50 Degrees(mild)' },
  { degrees: 55, label: '55 Degrees(normal)' },
  { degrees: 60, label: '60 Degrees(normal)' },
]

const SHOULDER_EXTERNAL_ROTATION_OPTIONS = [
  { degrees: 90, label: '90 Degrees(normal)' },
  { degrees: 85, label: '85 Degrees(normal)' },
  { degrees: 80, label: '80 Degrees(normal)' },
  { degrees: 75, label: '75 Degrees(mild)' },
  { degrees: 70, label: '70 Degrees(mild)' },
  { degrees: 65, label: '65 Degrees(mild)' },
  { degrees: 60, label: '60 Degrees(moderate)' },
  { degrees: 55, label: '55 Degrees(moderate)' },
  { degrees: 50, label: '50 Degrees(moderate)' },
  { degrees: 45, label: '45 Degrees(moderate)' },
  { degrees: 40, label: '40 Degrees(moderate)' },
  { degrees: 35, label: '35 Degrees(severe)' },
  { degrees: 30, label: '30 Degrees(severe)' },
  { degrees: 25, label: '25 Degrees(severe)' },
  { degrees: 15, label: '15 Degrees(severe)' },
  { degrees: 10, label: '10 Degrees(severe)' },
  { degrees: 5, label: '5 Degrees(severe)' },
]

const SHOULDER_INTERNAL_ROTATION_OPTIONS = SHOULDER_EXTERNAL_ROTATION_OPTIONS

const KNEE_FLEXION_OPTIONS = [
  { degrees: 130, label: '130(normal)' },
  { degrees: 125, label: '125 Degrees(normal)' },
  { degrees: 120, label: '120(normal)' },
  { degrees: 115, label: '115 Degrees(mild)' },
  { degrees: 110, label: '110 Degrees(mild)' },
  { degrees: 105, label: '105 Degrees(mild)' },
  { degrees: 100, label: '100 Degrees(moderate)' },
  { degrees: 95, label: '95 Degrees(moderate)' },
  { degrees: 90, label: '90 Degrees(moderate)' },
  { degrees: 85, label: '85 Degrees(moderate)' },
  { degrees: 80, label: '80 Degrees(moderate)' },
  { degrees: 75, label: '75 Degrees(moderate)' },
  { degrees: 70, label: '70 Degrees(moderate)' },
  { degrees: 65, label: '65 Degrees(severe)' },
  { degrees: 60, label: '60 Degrees(severe)' },
  { degrees: 55, label: '55 Degrees(severe)' },
  { degrees: 50, label: '50 Degrees(severe)' },
  { degrees: 45, label: '45 Degrees(severe)' },
  { degrees: 40, label: '40 Degrees(severe)' },
  { degrees: 35, label: '35 Degrees(severe)' },
  { degrees: 30, label: '30 Degrees(severe)' },
  { degrees: 25, label: '25 Degrees(severe)' },
]

function findClosestOption(
  options: ReadonlyArray<{ degrees: number; label: string }>,
  targetDegrees: number,
): string {
  let closest = options[0]
  let minDiff = Math.abs(targetDegrees - closest.degrees)
  for (const opt of options) {
    const diff = Math.abs(targetDegrees - opt.degrees)
    if (diff < minDiff) {
      minDiff = diff
      closest = opt
    }
  }
  return closest.label
}

function getShoulderRomOptions(movement: string): ReadonlyArray<{ degrees: number; label: string }> | null {
  if (movement === 'Abduction') return SHOULDER_ABDUCTION_OPTIONS
  if (movement === 'Horizontal Adduction') return SHOULDER_HORIZONTAL_ADDUCTION_OPTIONS
  if (movement === 'Flexion') return SHOULDER_FLEXION_OPTIONS
  if (movement === 'Extension') return SHOULDER_EXTENSION_OPTIONS
  if (movement === 'External Rotation') return SHOULDER_EXTERNAL_ROTATION_OPTIONS
  if (movement === 'Internal Rotation') return SHOULDER_INTERNAL_ROTATION_OPTIONS
  return null
}

// ==================== Spasm 修正 ====================

const SPASM_TEXTS: readonly string[] = [
  '(0)=No spasm',
  '(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.',
  '(+2)=Occasional spontaneous spasms and easily induced spasms.',
  '(+3)=>1 but < 10 spontaneous spasms per hour.',
  '(+4)=>10 spontaneous spasms per hour.',
]

function patchedIeSpasmGrading(basePain: number): string {
  const level = basePain >= 8 ? 4 : basePain >= 6 ? 3 : basePain >= 4 ? 2 : 1
  return SPASM_TEXTS[level]
}

// ==================== 主补丁函数 ====================

export interface PatchContext {
  /** 身体部位 */
  bodyPart: string
  /** 侧别 */
  laterality: string
  /** 基础疼痛值 */
  basePain: number
  /** TX progress（IE 时为 undefined） */
  progress?: number
  /** baselineCondition */
  baselineCondition?: 'good' | 'fair' | 'poor'
  /** chronicityLevel */
  chronicityLevel?: string
  /** ADL 改善信号 */
  adlImproved?: boolean
  /** 是否为 TX visit */
  isTX: boolean
}

/**
 * 从 GenerationContext + visitState 构建 PatchContext
 */
export function buildPatchContext(
  context: GenerationContext,
  visitState?: { painScaleCurrent?: number; progress?: number; soaChain?: { objective?: { romTrend?: string }; subjective?: { adlChange?: string } } },
): PatchContext {
  const basePain = deriveBasePain(context)
  const txPain = visitState?.painScaleCurrent ?? basePain
  const progress = visitState?.progress

  return {
    bodyPart: context.primaryBodyPart,
    laterality: context.laterality,
    basePain: visitState ? txPain : basePain,
    progress,
    baselineCondition: deriveBaselineCondition(context),
    chronicityLevel: context.chronicityLevel,
    adlImproved: context.noteType === 'TX' && visitState?.soaChain?.subjective?.adlChange === 'improved',
    isTX: context.noteType === 'TX',
  }
}

/**
 * 重新生成 ROM 行（通用格式：LBP/NECK/HIP/ELBOW/WRIST/ANKLE 等）
 * 格式: "3/5 Flexion: 45 Degrees(moderate)"
 */
function regenerateGenericRomLine(
  rom: ROMMovement,
  index: number,
  sideOffset: number,
  painLevel: number,
  romAdj: number,
  degreeLabel: string,
  pctx: PatchContext,
): string {
  const { strength, romValue, limitation } = patchedComputeRom(
    rom, index, sideOffset, painLevel, romAdj,
    pctx.progress, pctx.baselineCondition, pctx.chronicityLevel, pctx.adlImproved,
  )
  return `${strength} ${rom.movement}: ${romValue} ${degreeLabel}(${limitation})`
}

/**
 * 重新生成 SHOULDER ROM 行
 */
function regenerateShoulderRomLine(
  rom: ROMMovement,
  index: number,
  sideOffset: number,
  painLevel: number,
  romAdj: number,
  pctx: PatchContext,
): string {
  const { strength, romValue } = patchedComputeRom(
    rom, index, sideOffset, painLevel, romAdj,
    pctx.progress, pctx.baselineCondition, pctx.chronicityLevel, pctx.adlImproved,
  )
  const reductionPct = rom.normalDegrees > 0 ? 1 - (romValue / rom.normalDegrees) : 0
  const options = getShoulderRomOptions(rom.movement)
  const reducedDegrees = Math.round(rom.normalDegrees * (1 - reductionPct))
  const label = options
    ? findClosestOption(options, reducedDegrees)
    : `${reducedDegrees} degree(moderate)`

  // 精确匹配原始格式
  let movementLabel: string
  if (rom.movement === 'Abduction') {
    movementLabel = `${strength} Abduction:`
  } else if (rom.movement === 'Horizontal Adduction') {
    movementLabel = `${strength} Horizontal Adduction: `
  } else if (rom.movement === 'Flexion') {
    movementLabel = `${strength} Flexion :`
  } else if (rom.movement === 'Extension') {
    movementLabel = `${strength} Extension : `
  } else if (rom.movement === 'External Rotation') {
    movementLabel = `${strength} External rotation : `
  } else if (rom.movement === 'Internal Rotation') {
    movementLabel = `${strength} Internal rotation : `
  } else {
    movementLabel = `${strength} ${rom.movement}: `
  }
  return `${movementLabel}${label}`
}

/**
 * 重新生成 KNEE ROM 行
 */
function regenerateKneeRomLine(
  rom: ROMMovement,
  index: number,
  sideOffset: number,
  painLevel: number,
  romAdj: number,
  pctx: PatchContext,
): string {
  const { strength, romValue } = patchedComputeRom(
    rom, index, sideOffset, painLevel, romAdj,
    pctx.progress, pctx.baselineCondition, pctx.chronicityLevel, pctx.adlImproved,
  )
  const reductionPct = rom.normalDegrees > 0 ? 1 - (romValue / rom.normalDegrees) : 0

  let label: string
  if (rom.movement.includes('Extension')) {
    const reduced = Math.round(rom.normalDegrees * (1 - reductionPct))
    label = reduced < 0 ? '-5(severe)' : '0(normal)'
  } else {
    const reducedDegrees = Math.round(rom.normalDegrees * (1 - reductionPct))
    label = findClosestOption(KNEE_FLEXION_OPTIONS, reducedDegrees)
  }

  return `${strength} ${rom.movement}: ${label}`
}

/**
 * 生成完整的 ROM 区块文本（补丁版）
 */
function generatePatchedRomBlock(pctx: PatchContext, visitState?: { progress?: number; soaChain?: { objective?: { romTrend?: string } } }): string {
  const bp = pctx.bodyPart
  const romData = BODY_PART_ROM[bp]
  if (!romData) return ''

  const isSpine = ['NECK', 'LBP', 'MIDDLE_BACK', 'UPPER_BACK', 'MID_LOW_BACK'].includes(bp)

  // TX 模式: ROM pain offset 从 2.8 降到 1.4
  const painLevel: number = pctx.isTX && pctx.progress !== undefined
    ? Math.max(1, pctx.basePain - (pctx.progress * 1.4))
    : pctx.basePain

  const romAdj = visitState
    ? Math.min(10, Math.round(((visitState.progress ?? 0) * 8) + (visitState.soaChain?.objective?.romTrend === 'improved' ? 3 : 1)))
    : 0

  let block = ''

  if (bp === 'KNEE' && pctx.laterality === 'bilateral') {
    const sides = ['Right', 'Left'] as const
    for (const side of sides) {
      const adjustedPain = side === 'Left' ? painLevel : Math.max(1, painLevel - 1)
      const sideOffset = side === 'Left' ? 0 : 1
      const sideRomAdj = side === 'Left' ? 0 : 5
      block += `${side} Knee Muscles Strength and Joint ROM:\n\n`
      for (let i = 0; i < romData.length; i++) {
        block += regenerateKneeRomLine(romData[i], i, sideOffset, adjustedPain, sideRomAdj, pctx) + '\n'
      }
      block += '\n'
    }
  } else if (bp === 'KNEE') {
    const sideLabel = pctx.laterality === 'left' ? 'Left' : 'Right'
    block += `${sideLabel} Knee Muscles Strength and Joint ROM:\n\n`
    for (let i = 0; i < romData.length; i++) {
      block += regenerateKneeRomLine(romData[i], i, 0, painLevel, 0, pctx) + '\n'
    }
    block += '\n'
  } else if (bp === 'SHOULDER') {
    const renderSide = (side: string) => {
      const isLeft = side === 'Left'
      const adjustedPain = isLeft ? painLevel : Math.max(1, painLevel - 1)
      const sideOffset = isLeft ? 0 : 1
      const sideRomAdj = isLeft ? 0 : 5
      block += `${side} Shoulder Muscles Strength and Joint ROM\n`
      for (let i = 0; i < romData.length; i++) {
        block += regenerateShoulderRomLine(romData[i], i, sideOffset, adjustedPain, sideRomAdj, pctx) + '\n'
      }
      block += '\n'
    }
    if (pctx.laterality === 'bilateral') {
      renderSide('Right')
      renderSide('Left')
    } else {
      renderSide(pctx.laterality === 'left' ? 'Left' : 'Right')
    }
  } else {
    // Generic: LBP, NECK, HIP, ELBOW, WRIST, ANKLE, MIDDLE_BACK, MID_LOW_BACK
    const romType = isSpine ? 'Spine ROM' : 'Joint ROM'
    const degreeLabel = isSpine ? 'Degrees' : 'degree'
    const bodyPartLabel = bp === 'NECK' ? 'Cervical'
      : bp === 'LBP' ? 'Lumbar'
        : bp === 'MID_LOW_BACK' ? 'Thoracolumbar'
          : bp === 'MIDDLE_BACK' ? 'Thoracic'
            : pctx.laterality !== 'unspecified'
              ? `${pctx.laterality.charAt(0).toUpperCase()}${pctx.laterality.slice(1)} ${bp.charAt(0) + bp.slice(1).toLowerCase()}`
              : bp.charAt(0) + bp.slice(1).toLowerCase()
    const romSuffix = bp === 'NECK' ? ' Assessment:' : ''
    block += `${bodyPartLabel} Muscles Strength and ${romType}${romSuffix}\n`

    for (let i = 0; i < romData.length; i++) {
      block += regenerateGenericRomLine(romData[i], i, 0, painLevel, romAdj, degreeLabel, pctx) + '\n'
    }
    block += '\n'
  }

  return block
}

/**
 * 对完整 SOAP 文本应用补丁
 *
 * 策略：
 * 1. 找到 Objective 中的 ROM 区块
 * 2. 用修正公式重新生成 ROM 区块
 * 3. 替换原文本中的 ROM 区块
 * 4. 修正 IE Spasm 硬编码
 */
export function patchSOAPText(
  fullText: string,
  context: GenerationContext,
  visitState?: { painScaleCurrent?: number; progress?: number; soaChain?: { objective?: { romTrend?: string }; subjective?: { adlChange?: string } } },
): string {
  const pctx = buildPatchContext(context, visitState)

  // 分离 Objective 段
  const objStart = fullText.indexOf('Objective\n')
  if (objStart === -1) return fullText

  const objContentStart = objStart + 'Objective\n'.length
  const assessmentStart = fullText.indexOf('\nAssessment\n', objContentStart)
  const objEnd = assessmentStart !== -1 ? assessmentStart : fullText.length

  let objectiveText = fullText.slice(objContentStart, objEnd)

  // 1. 替换 ROM 区块
  const romBounds = findRomBlockBounds(objectiveText)
  if (romBounds) {
    const beforeRom = objectiveText.slice(0, romBounds.start)
    const afterRom = objectiveText.slice(romBounds.end)
    const newRomBlock = generatePatchedRomBlock(pctx, visitState)
    objectiveText = beforeRom + newRomBlock + afterRom
  }

  // 2. 修正 IE Spasm 硬编码
  if (!pctx.isTX) {
    const spasmHardcoded = 'Frequency Grading Scale:(+3)=>1 but < 10 spontaneous spasms per hour.'
    if (objectiveText.includes(spasmHardcoded)) {
      const correctedSpasm = `Frequency Grading Scale:${patchedIeSpasmGrading(pctx.basePain)}`
      objectiveText = objectiveText.replace(spasmHardcoded, correctedSpasm)
    }
  }

  // 重新组装 Objective
  let result = fullText.slice(0, objContentStart) + objectiveText + fullText.slice(objEnd)

  // 3. 替换 Plan Goals（仅 IE）
  if (!pctx.isTX) {
    result = patchPlanGoals(result, context)
  }

  return result
}

// ==================== Phase 2: Patched Goals ====================

export interface PatchedGoals {
  pain: { st: string; lt: string }
  symptomPct: { st: string; lt: string }
  tightness: { st: string; lt: string }
  tenderness: { st: number; lt: number }
  spasm: { st: number; lt: number }
  strength: { st: string; lt: string }
  rom: { st: string; lt: string }
  adl: { st: string; lt: string }
}

/** 5 个基础模型 (pain 5-9) */
interface BaseModel {
  pain: { st: string; lt: string }
  symptomPct: { st: string; lt: string }
  tightness: { st: string; lt: string }
  tenderness: { st: number; lt: number }
  spasm: { st: number; lt: number }
  strength: { st: string; lt: string }
  rom: { st: string; lt: string }
  adl: { st: string; lt: string }
}

const BASE_MODELS: Record<number, BaseModel> = {
  5: {
    pain: { st: '3', lt: '2' },
    symptomPct: { st: '(30%-40%)', lt: '(20%-30%)' },
    tightness: { st: 'mild', lt: 'mild' },
    tenderness: { st: 1, lt: 1 },
    spasm: { st: 1, lt: 1 },
    strength: { st: '4+', lt: '4+' },
    rom: { st: '50%', lt: '60%' },
    adl: { st: 'mild', lt: 'mild' },
  },
  6: {
    pain: { st: '3', lt: '2' },
    symptomPct: { st: '(30%-40%)', lt: '(20%-30%)' },
    tightness: { st: 'mild', lt: 'mild' },
    tenderness: { st: 1, lt: 1 },
    spasm: { st: 1, lt: 1 },
    strength: { st: '4+', lt: '4+' },
    rom: { st: '50%', lt: '65%' },
    adl: { st: 'mild', lt: 'mild' },
  },
  7: {
    pain: { st: '3-4', lt: '2-3' },
    symptomPct: { st: '(30%-40%)', lt: '(20%-30%)' },
    tightness: { st: 'moderate', lt: 'mild' },
    tenderness: { st: 2, lt: 1 },
    spasm: { st: 2, lt: 1 },
    strength: { st: '4', lt: '4+' },
    rom: { st: '55%', lt: '70%' },
    adl: { st: 'mild-moderate', lt: 'mild' },
  },
  8: {
    pain: { st: '4-5', lt: '3' },
    symptomPct: { st: '(40%-50%)', lt: '(20%-30%)' },
    tightness: { st: 'moderate', lt: 'mild to moderate' },
    tenderness: { st: 2, lt: 1 },
    spasm: { st: 2, lt: 1 },
    strength: { st: '4', lt: '4+' },
    rom: { st: '55%', lt: '70%' },
    adl: { st: 'moderate', lt: 'mild-moderate' },
  },
  9: {
    pain: { st: '5-6', lt: '3-4' },
    symptomPct: { st: '(50%-60%)', lt: '(30%-40%)' },
    tightness: { st: 'moderate to severe', lt: 'moderate' },
    tenderness: { st: 2, lt: 1 },
    spasm: { st: 2, lt: 1 },
    strength: { st: '4', lt: '4+' },
    rom: { st: '50%', lt: '65%' },
    adl: { st: 'moderate-severe', lt: 'mild-moderate' },
  },
}

/** 将 pain 值映射到最近的基础模型 key */
function resolveBaseModel(painCurrent: number): BaseModel {
  const p = Math.round(Math.max(5, Math.min(9, painCurrent)))
  return BASE_MODELS[p]
}

/** 微调选项 */
interface AdjustmentInput {
  medicalHistory?: string[]
  age?: number
  bodyPart?: string
}

function parsePainRange(s: string): { lo: number; hi: number } {
  const parts = s.split('-').map(Number)
  return parts.length === 2 ? { lo: parts[0], hi: parts[1] } : { lo: parts[0], hi: parts[0] }
}

function formatPainRange(lo: number, hi: number): string {
  return lo === hi ? String(lo) : `${lo}-${hi}`
}

function parseRomPct(s: string): number {
  return parseInt(s.replace('%', ''))
}

/**
 * 计算补丁版 Goals
 *
 * @param painCurrent - 当前疼痛值 (5-9)
 * @param severity - severity level (用于 symptomPct 等)
 * @param bodyPart - 身体部位
 * @param symptomType - 症状类型 (soreness, etc.)
 * @param adjustments - 微调输入 (medicalHistory, age)
 */
export function computePatchedGoals(
  painCurrent: number,
  severity: SeverityLevel | string,
  bodyPart: BodyPart | string,
  symptomType: string = 'soreness',
  adjustments?: AdjustmentInput,
): PatchedGoals {
  const base = resolveBaseModel(painCurrent)

  // Deep copy base model
  const goals: PatchedGoals = {
    pain: { ...base.pain },
    symptomPct: { ...base.symptomPct },
    tightness: { ...base.tightness },
    tenderness: { ...base.tenderness },
    spasm: { ...base.spasm },
    strength: { ...base.strength },
    rom: { ...base.rom },
    adl: { ...base.adl },
  }

  // Body part adjustments (always apply, independent of medical history)
  if (bodyPart === 'SHOULDER') {
    goals.rom = {
      st: `${Math.max(30, parseRomPct(goals.rom.st) - 5)}%`,
      lt: `${Math.max(40, parseRomPct(goals.rom.lt) - 5)}%`,
    }
  }
  if (bodyPart === 'NECK') {
    const TIGHT_LEVELS_NECK = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
    const ltIdx = TIGHT_LEVELS_NECK.indexOf(goals.tightness.lt)
    if (ltIdx < 1) {
      goals.tightness = { ...goals.tightness, lt: 'mild to moderate' }
    }
  }

  if (!adjustments) return goals

  const history = adjustments.medicalHistory ?? []
  const age = adjustments.age

  // Skip adjustments if no meaningful input
  if (history.length === 0 && age === undefined) return goals

  // 1. progressMultiplier < 0.90 → Pain ST/LT each +1
  const progMult = inferProgressMultiplier(history, age)
  if (progMult < 0.90) {
    const stRange = parsePainRange(goals.pain.st)
    const ltRange = parsePainRange(goals.pain.lt)
    goals.pain = {
      st: formatPainRange(stRange.lo + 1, stRange.hi + 1),
      lt: formatPainRange(ltRange.lo + 1, ltRange.hi + 1),
    }
  }

  // 2. initialAdjustments from medical history + body part
  const adj = inferInitialAdjustments(history, bodyPart as BodyPart)

  // severityBump > 0 → Tenderness ST +1, Tightness ST up one level
  if (adj.severityBump > 0) {
    goals.tenderness = { ...goals.tenderness, st: goals.tenderness.st + 1 }
    const TIGHT_LEVELS = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
    const tIdx = TIGHT_LEVELS.indexOf(goals.tightness.st)
    if (tIdx >= 0 && tIdx < TIGHT_LEVELS.length - 1) {
      goals.tightness = { ...goals.tightness, st: TIGHT_LEVELS[tIdx + 1] }
    }
  }

  // romDeficitBump > 0 → ROM ST/LT each -round(bump×100)%
  if (adj.romDeficitBump > 0) {
    const romDelta = Math.round(adj.romDeficitBump * 100)
    goals.rom = {
      st: `${Math.max(30, parseRomPct(goals.rom.st) - romDelta)}%`,
      lt: `${Math.max(40, parseRomPct(goals.rom.lt) - romDelta)}%`,
    }
  }

  // spasmBump > 0 → Spasm ST +1, LT +1
  if (adj.spasmBump > 0) {
    goals.spasm = {
      st: goals.spasm.st + adj.spasmBump,
      lt: goals.spasm.lt + adj.spasmBump,
    }
  }

  // 3. baselineCondition === 'poor' → Strength cap 4, ROM LT -5%
  const condition = deriveBaselineCondition({
    medicalHistory: history,
    age,
  } as GenerationContext)
  if (condition === 'poor') {
    const capStr = (s: string) => {
      const map: Record<string, number> = { '3': 3, '3+': 3.5, '4': 4, '4+': 4.5, '5': 5 }
      const val = map[s] ?? 4
      return val > 4 ? '4' : s
    }
    goals.strength = { st: capStr(goals.strength.st), lt: capStr(goals.strength.lt) }
    goals.rom = {
      ...goals.rom,
      lt: `${Math.max(40, parseRomPct(goals.rom.lt) - 5)}%`,
    }
  }

  return goals
}

// ==================== Phase 3: Plan 文本替换 ====================

/**
 * 替换 IE Plan 中的 Goals 行
 * 使用 regex 逐行替换，保持原始格式
 */
function patchPlanGoals(fullText: string, context: GenerationContext): string {
  const planStart = fullText.indexOf('Plan\n')
  if (planStart === -1) return fullText

  const stStart = fullText.indexOf('Short Term Goal', planStart)
  if (stStart === -1) return fullText

  const goals = computePatchedGoals(
    deriveBasePain(context),
    context.severityLevel || 'moderate to severe',
    context.primaryBodyPart,
    context.associatedSymptom || 'soreness',
    {
      medicalHistory: context.medicalHistory,
      age: context.age,
      bodyPart: context.primaryBodyPart,
    },
  )

  let planText = fullText.slice(stStart)
  const afterPlanEnd = fullText.indexOf('\nSelect Needle Size', stStart)
  const needleStart = fullText.indexOf('\nDaily acupuncture', stStart)
  const endMarker = afterPlanEnd !== -1 ? afterPlanEnd
    : needleStart !== -1 ? needleStart
      : fullText.length
  planText = fullText.slice(stStart, endMarker)

  // Replace ST Goals lines
  planText = planText.replace(
    /Decrease Pain Scale to [^\n]+/,
    `Decrease Pain Scale to ${goals.pain.st}.`,
  )
  planText = planText.replace(
    /Decrease \w+ sensation Scale to [^\n]+/,
    `Decrease ${context.associatedSymptom || 'soreness'} sensation Scale to ${goals.symptomPct.st}`,
  )
  planText = planText.replace(
    /Decrease Muscles Tightness to [^\n]+/,
    `Decrease Muscles Tightness to ${goals.tightness.st}`,
  )
  planText = planText.replace(
    /Decrease Muscles Tenderness to Grade [^\n]+/,
    `Decrease Muscles Tenderness to Grade ${goals.tenderness.st}`,
  )
  planText = planText.replace(
    /Decrease Muscles Spasms to Grade [^\n]+/,
    `Decrease Muscles Spasms to Grade ${goals.spasm.st}`,
  )
  planText = planText.replace(
    /Increase Muscles Strength to [^\n]+/,
    `Increase Muscles Strength to ${goals.strength.st}`,
  )

  // Replace LT Goals lines (after "Long Term Goal" header)
  const ltIdx = planText.indexOf('Long Term Goal')
  if (ltIdx !== -1) {
    let ltPart = planText.slice(ltIdx)
    ltPart = ltPart.replace(
      /Decrease Pain Scale to [^\n]+/,
      `Decrease Pain Scale to ${goals.pain.lt}`,
    )
    ltPart = ltPart.replace(
      /Decrease \w+ sensation Scale to [^\n]+/,
      `Decrease ${context.associatedSymptom || 'soreness'} sensation Scale to ${goals.symptomPct.lt}`,
    )
    const tightnessLT = goals.tightness.lt.replace(/ to /g, '-')
    ltPart = ltPart.replace(
      /Decrease Muscles Tightness to [^\n]+/,
      `Decrease Muscles Tightness to ${tightnessLT}`,
    )
    ltPart = ltPart.replace(
      /Decrease Muscles Tenderness to Grade [^\n]+/,
      `Decrease Muscles Tenderness to Grade ${goals.tenderness.lt}`,
    )
    ltPart = ltPart.replace(
      /Decrease Muscles Spasms to Grade [^\n]+/,
      `Decrease Muscles Spasms to Grade ${goals.spasm.lt}`,
    )
    ltPart = ltPart.replace(
      /Increase Muscles Strength to [^\n]+/,
      `Increase Muscles Strength to ${goals.strength.lt}`,
    )
    ltPart = ltPart.replace(
      /Increase ROM [^\n]+/,
      `Increase ROM ${goals.rom.lt}`,
    )
    ltPart = ltPart.replace(
      /Decrease impaired Activities of Daily Living to [^\n.]+\.?/,
      `Decrease impaired Activities of Daily Living to ${goals.adl.lt}.`,
    )
    planText = planText.slice(0, ltIdx) + ltPart
  }

  return fullText.slice(0, stStart) + planText + fullText.slice(endMarker)
}
