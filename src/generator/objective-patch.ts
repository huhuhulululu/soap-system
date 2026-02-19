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
import type { GenerationContext } from '../types'

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
  '3+/5',  // pain 6
  '3+/5',  // pain 7
  '3/5',   // pain 8
  '3/5',   // pain 9
  '3-/5',  // pain 10
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
): { strength: string; romValue: number; limitation: string } {
  const sensitivity = getPainSensitivity(rom.difficulty)
  const microVar = ((index + sideOffset) % 3 - 1) * 0.5
  const effectivePain = clamp(adjustedPain * sensitivity + microVar, 1, 10)

  let strength = patchedStrength(effectivePain)
  strength = applyConditionDowngrade(strength, baselineCondition, chronicityLevel)

  if (progress !== undefined && progress > 0) {
    strength = bumpStrength(strength, progress)
  }

  let romValue = patchedRomValue(rom.normalDegrees, effectivePain, rom.difficulty)

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
  /** 是否为 TX visit */
  isTX: boolean
}

/**
 * 从 GenerationContext + visitState 构建 PatchContext
 */
export function buildPatchContext(
  context: GenerationContext,
  visitState?: { painScaleCurrent?: number; progress?: number },
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
    pctx.progress, pctx.baselineCondition, pctx.chronicityLevel,
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
    pctx.progress, pctx.baselineCondition, pctx.chronicityLevel,
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
    pctx.progress, pctx.baselineCondition, pctx.chronicityLevel,
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
  visitState?: { painScaleCurrent?: number; progress?: number; soaChain?: { objective?: { romTrend?: string } } },
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

  // 重新组装
  return fullText.slice(0, objContentStart) + objectiveText + fullText.slice(objEnd)
}
