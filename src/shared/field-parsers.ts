/**
 * Shared Field Parsers — 统一的字段解析函数
 *
 * 命名规范：
 * - parse*()  — 文本 → 枚举/类型
 * - extract*() — 文本 → 数值
 * - compare*() — 两值比较
 *
 * 来源合并：
 * - note-checker.ts:  parsePainCurrent, parseGoalPainTarget, parseAdlSeverity,
 *                     parseProgressStatus, extractProgressReasons, frequencyLevel,
 *                     compareSeverity, scoreByStrength
 * - bridge.ts:        parseSeverityFromAdlText, parsePainCurrent
 * - correction-generator.ts: parsePainCurrent
 * - parser.ts:        parseAdlDifficultyLevel
 * - soap-constraints.ts: parseTendernessScale, parseSpasmScale, severityRank, frequencyRank
 */

import type { SeverityLevel } from '../types'

// ============ Pain Parsing ============

/**
 * 从 VisitRecord.subjective.painScale 提取当前疼痛值。
 * 处理三种格式：{ current }, { value }, { range: { max } }
 *
 * 合并自 note-checker.ts:24, bridge.ts:70, correction-generator.ts:16
 */
export function extractPainCurrent(painScale: unknown): number {
    if (!painScale || typeof painScale !== 'object') return warnFallback('not an object')
    const ps = painScale as Record<string, unknown>

    if (typeof ps.current === 'number') return ps.current
    if (typeof ps.value === 'number') return ps.value
    const range = ps.range
    if (range && typeof range === 'object' && typeof (range as Record<string, unknown>).max === 'number') {
        return (range as Record<string, unknown>).max as number
    }
    return warnFallback('no recognized key')
}

function warnFallback(reason: string): number {
    process.stderr.write(`[field-parsers] extractPainCurrent fallback (${reason}), returning 7\n`)
    return 7
}

/**
 * 从目标文本提取最小数值（用于 painScaleTarget 解析）。
 *
 * 合并自 note-checker.ts:32
 */
export function parseGoalPainTarget(raw?: string): number | null {
    if (!raw) return null
    const nums = raw.match(/\d+/g)?.map(Number) || []
    if (nums.length === 0) return null
    return Math.min(...nums)
}

// ============ Severity Parsing ============

/** 严重程度排名常量表 */
const SEVERITY_ORDER: Record<string, number> = {
    mild: 1,
    'mild to moderate': 2,
    moderate: 3,
    'moderate to severe': 4,
    severe: 5,
}

/**
 * 从 ADL 文本解析严重程度等级。
 *
 * 合并自 note-checker.ts:50, bridge.ts:55, parser.ts:436
 * 三处实现逻辑完全一致。
 */
export function parseAdlSeverity(adlText: string): SeverityLevel {
    const t = (adlText || '').toLowerCase()
    if (t.includes('moderate to severe')) return 'moderate to severe'
    if (t.includes('mild to moderate')) return 'mild to moderate'
    if (t.includes('severe')) return 'severe'
    if (t.includes('moderate')) return 'moderate'
    return 'mild'
}

/**
 * 将严重程度文本转换为数值排名。
 * mild=1, mild to moderate=2, moderate=3, moderate to severe=4, severe=5
 *
 * 合并自 soap-constraints.ts:70 (原名 severityRank)
 */
export function severityToRank(severity: string): number {
    return SEVERITY_ORDER[severity.toLowerCase()] ?? 3
}

/**
 * 比较两个严重程度的相对大小。
 * 返回值 > 0 表示 cur 更严重；< 0 表示 cur 更轻；0 表示相同或无法比较。
 *
 * 合并自 note-checker.ts:125
 */
export function compareSeverity(cur: string, prev: string): number {
    const order = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
    const c = order.indexOf(cur)
    const p = order.indexOf(prev)
    if (c < 0 || p < 0) return 0
    return c - p
}

// ============ Objective Scale Parsing ============

/**
 * 从压痛等级描述中提取数值（如 "(+3)" → 3）。
 *
 * 合并自 soap-constraints.ts:56
 */
export function parseTendernessScale(grading: string): number {
    const m = grading.match(/\+(\d)/)
    return m ? parseInt(m[1], 10) : 2
}

/**
 * 从痉挛频率描述中提取数值（如 "(+2)" → 2）。
 *
 * 合并自 soap-constraints.ts:61
 */
export function parseSpasmScale(grading: string): number {
    if (/\(0\)/.test(grading)) return 0
    const m = grading.match(/\+(\d)/)
    return m ? parseInt(m[1], 10) : 2
}

/**
 * 将肌力评分文本转换为数值（如 "4+/5" → 4.5）。
 *
 * 合并自 note-checker.ts:15
 */
export function parseStrengthScore(strengthText: string): number {
    const t = strengthText.trim()
    const map: Record<string, number> = {
        '0/5': 0, '1/5': 1, '2/5': 2, '2+/5': 2.5, '3/5': 3, '3+/5': 3.5,
        '4-/5': 3.8, '4/5': 4, '4+/5': 4.5, '5/5': 5,
    }
    return map[t] ?? 4
}

// ============ Frequency Parsing ============

/** 频率等级排名常量表 */
const FREQUENCY_ORDER: Record<string, number> = {
    intermittent: 0,
    occasional: 1,
    frequent: 2,
    constant: 3,
}

/**
 * 将疼痛频率文本转换为数值等级。
 * intermittent=0, occasional=1, frequent=2, constant=3
 *
 * 合并自 note-checker.ts:59 (原名 frequencyLevel),
 *       soap-constraints.ts:78 (原名 frequencyRank)
 *
 * 两处实现逻辑一致（均使用 includes 匹配）。
 */
export function parseFrequencyLevel(frequency: string): number {
    const t = (frequency || '').toLowerCase()
    for (const [key, rank] of Object.entries(FREQUENCY_ORDER)) {
        if (t.includes(key)) return rank
    }
    return 2 // 默认 frequent
}

// ============ Progress Parsing ============

/** 正向进展原因列表 */
export const POSITIVE_PROGRESS_REASONS = [
    'maintain regular treatments',
    'reduced level of pain',
    'energy level improved',
    'sleep quality improved',
    'continuous treatment',
    'can move joint more freely',
] as const

/** 负向进展原因列表 */
export const NEGATIVE_PROGRESS_REASONS = [
    'skipped treatments',
    'discontinuous treatment',
    'stopped treatment',
    'intense work',
    'bad posture',
    'lack of exercise',
    'exposure to cold air',
] as const

/**
 * 从 chiefComplaint 解析进展状态。
 *
 * 合并自 note-checker.ts:87
 */
export function parseProgressStatus(chiefComplaint: string): 'improvement' | 'exacerbate' | 'similar' | null {
    const cc = (chiefComplaint || '').toLowerCase()
    if (cc.includes('improvement of symptom')) return 'improvement'
    if (cc.includes('exacerbate of symptom')) return 'exacerbate'
    if (cc.includes('similar symptom')) return 'similar'
    return null
}

/**
 * 从 chiefComplaint 提取进展原因（正向和负向）。
 *
 * 合并自 note-checker.ts:95
 */
export function extractProgressReasons(chiefComplaint: string): { positive: string[]; negative: string[] } {
    const cc = (chiefComplaint || '').toLowerCase()
    const positive: string[] = []
    const negative: string[] = []

    for (const reason of POSITIVE_PROGRESS_REASONS) {
        if (cc.includes(reason.toLowerCase())) {
            positive.push(reason)
        }
    }

    for (const reason of NEGATIVE_PROGRESS_REASONS) {
        if (cc.includes(reason.toLowerCase())) {
            negative.push(reason)
        }
    }

    return { positive, negative }
}
