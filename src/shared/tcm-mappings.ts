/**
 * 统一 TCM 证型映射 — 舌脉校验 + 疼痛类型映射
 * 数据源: src/knowledge/tcm-patterns.ts (权威知识库)
 * 消费方: note-checker, correction-generator, WriterView
 */
import { TCM_PATTERNS } from '../knowledge/tcm-patterns'

// ===== 舌脉→证型校验 =====

/** 校验舌脉是否与证型一致 (覆盖全部 21 种证型) */
export function isTonguePatternConsistent(
  localPattern: string | undefined,
  tongue: string,
  pulse: string
): boolean {
  const lp = (localPattern || '').toLowerCase()
  const t = (tongue || '').toLowerCase()
  const p = (pulse || '').toLowerCase()
  if (!lp) return true

  // 在 TCM_PATTERNS 中查找匹配的证型
  const entry = Object.entries(TCM_PATTERNS).find(
    ([key]) => lp.includes(key.toLowerCase())
  )
  if (!entry) return true // 未知证型不校验

  const pattern = entry[1]
  const tongueMatch = pattern.tongue.some(tw => t.includes(tw.toLowerCase()))
  const pulseMatch = pattern.pulse.some(pw => p.includes(pw.toLowerCase()))
  return tongueMatch && pulseMatch
}

// ===== 证型→舌脉修正值 (correction-generator 用) =====

/** 获取证型对应的标准舌脉描述 (用于自动修正) */
export function getPatternTonguePulse(
  patternName: string
): { tongue: string; pulse: string } | undefined {
  const pattern = TCM_PATTERNS[patternName]
  if (!pattern) {
    // 模糊匹配: 支持 "Wind-Cold" 匹配 "Wind-Cold Invasion"
    const entry = Object.entries(TCM_PATTERNS).find(
      ([key]) => key.toLowerCase().includes(patternName.toLowerCase())
        || patternName.toLowerCase().includes(key.toLowerCase())
    )
    if (!entry) return undefined
    return {
      tongue: entry[1].tongue.join(', '),
      pulse: entry[1].pulse.join(', '),
    }
  }
  return {
    tongue: pattern.tongue.join(', '),
    pulse: pattern.pulse.join(', '),
  }
}

/** 批量获取所有证型的舌脉映射 (兼容旧 PATTERN_TO_TONGUE_PULSE 用法) */
export function getAllPatternTonguePulse(): Record<string, { tongue: string; pulse: string }> {
  const result: Record<string, { tongue: string; pulse: string }> = {}
  for (const [name, pattern] of Object.entries(TCM_PATTERNS)) {
    result[name] = {
      tongue: pattern.tongue.join(', '),
      pulse: pattern.pulse.join(', '),
    }
  }
  return result
}

// ===== 疼痛类型→证型映射 (S2 规则) =====

export const PAIN_TYPE_BY_PATTERN: Record<string, string[]> = {
  'Blood Stasis': ['Pricking', 'Shooting'],
  'Cold-Damp': ['Freezing', 'Aching'],
  'Cold-Damp + Wind-Cold': ['Freezing', 'Aching'],
  'Wind-Cold Invasion': ['Freezing', 'Aching'],
  'Qi Stagnation': ['Dull', 'Aching'],
  'Qi Stagnation, Blood Stasis': ['Dull', 'Aching', 'Pricking'],
  'Liver Qi Stagnation': ['Dull', 'Aching'],
  'Qi & Blood Deficiency': ['Dull', 'Weighty'],
  'Blood Deficiency': ['Dull'],
  'Phlegm-Damp': ['Aching', 'Weighty'],
  'Damp-Heat': ['Burning', 'Aching'],
  'LV/GB Damp-Heat': ['Burning'],
  'Phlegm-Heat': ['Burning'],
}

/** 校验疼痛类型是否与证型匹配 */
export function isPainTypeConsistentWithPattern(
  localPattern: string,
  painTypes: string[]
): { consistent: boolean; expected: string[] } {
  const entry = Object.entries(PAIN_TYPE_BY_PATTERN).find(
    ([key]) => localPattern.includes(key)
  )
  if (!entry) return { consistent: true, expected: [] }

  const expected = entry[1]
  const hasOverlap = painTypes.some(
    p => expected.some(e => p.toLowerCase().includes(e.toLowerCase()))
  )
  return { consistent: hasOverlap, expected }
}
