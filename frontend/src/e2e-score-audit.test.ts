/**
 * E2E Score Audit — 大批量随机 seed 端到端评分检测
 * 完整链路: generateTXSequenceStates → exportSOAPAsText → ensureHeader → parseOptumNote → checkDocument
 * 模拟真实流程: Writer 生成文本 → Checker 页面解析检查
 *
 * 运行: AUDIT_SEED_COUNT=100 npx vitest run frontend/src/e2e-score-audit.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { generateTXSequenceStates, type TXVisitState } from '../../src/generator/tx-sequence-engine'
import { exportSOAPAsText } from '../../src/generator/soap-generator'
import { parseOptumNote } from '../../parsers/optum-note/parser'
import { checkDocument } from '../../parsers/optum-note/checker/note-checker'
import { setWhitelist } from '../../src/parser/template-rule-whitelist.browser'
import whitelistData from './data/whitelist.json'

beforeAll(() => {
    setWhitelist(whitelistData)
})

// ========== 随机输入生成器 ==========

const BODY_PARTS_TX = ['LBP', 'NECK', 'SHOULDER', 'KNEE', 'ELBOW'] as const
const LATERALITIES = ['left', 'right', 'bilateral'] as const
const INSURANCE_TYPES = ['OPTUM', 'HF', 'WC', 'VC', 'ELDERPLAN', 'NONE'] as const
const CHRONICITIES = ['Acute', 'Sub Acute', 'Chronic'] as const
const LOCAL_PATTERNS = ['Qi Stagnation', 'Blood Stasis', 'Cold-Damp + Wind-Cold', 'Damp-Heat', 'Qi & Blood Deficiency'] as const
const SYSTEMIC_PATTERNS = ['Kidney Yang Deficiency', 'Kidney Yin Deficiency', 'Qi Deficiency', 'Liver Yang Rising', 'Spleen Deficiency'] as const
const SYMPTOMS = ['soreness', 'stiffness', 'heaviness', 'weakness', 'numbness'] as const
const PAIN_TYPES_POOL = ['Dull', 'Burning', 'Freezing', 'Shooting', 'Tingling', 'Stabbing', 'Aching'] as const
const RADIATIONS = ['without radiation', 'with radiation to R arm', 'with radiation to L arm', 'with dizziness'] as const
const CAUSATIVES = ['age related/degenerative changes', 'poor sleep', 'prolong sitting', 'weather change', 'intense excise'] as const
const RELIEVERS = ['Changing positions', 'Resting', 'Stretching', 'Applying heating pad', 'Massage'] as const

function mulberry32(seed: number) {
    let t = seed >>> 0
    return () => {
        t += 0x6D2B79F5
        let r = Math.imul(t ^ (t >>> 15), 1 | t)
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    }
}

function pick<T>(arr: readonly T[], rng: () => number): T {
    return arr[Math.floor(rng() * arr.length)]
}

function pickMultiple<T>(arr: readonly T[], count: number, rng: () => number): T[] {
    const shuffled = [...arr].sort(() => rng() - 0.5)
    return shuffled.slice(0, count)
}

function severityFromPain(pain: number) {
    if (pain >= 9) return 'severe' as const
    if (pain >= 7) return 'moderate to severe' as const
    if (pain >= 6) return 'moderate' as const
    if (pain >= 4) return 'mild to moderate' as const
    return 'mild' as const
}

/** 与 checker.js L90 的 ensureHeader 相同 */
function ensureHeader(text: string): string {
    if (/PATIENT:|DOB:/i.test(text)) return text
    return 'UNKNOWN, PATIENT (DOB: 01/01/2000 ID: 0000000000) Date of Service: 01/01/2025 Printed on: 01/01/2025\n' + text
}

function generateRandomInput(seed: number) {
    const rng = mulberry32(seed)
    const pain = Math.floor(rng() * 8) + 3
    const bp = pick(BODY_PARTS_TX, rng)
    return {
        context: {
            noteType: 'TX' as const,
            insuranceType: pick(INSURANCE_TYPES, rng),
            primaryBodyPart: bp,
            laterality: pick(LATERALITIES, rng),
            localPattern: pick(LOCAL_PATTERNS, rng),
            systemicPattern: pick(SYSTEMIC_PATTERNS, rng),
            chronicityLevel: pick(CHRONICITIES, rng),
            severityLevel: severityFromPain(pain),
            painCurrent: pain,
            associatedSymptom: pick(SYMPTOMS, rng),
            symptomDuration: { value: String(Math.floor(rng() * 10) + 1), unit: pick(['week(s)', 'month(s)', 'year(s)'] as const, rng) },
            painRadiation: pick(RADIATIONS, rng),
            causativeFactors: pickMultiple(CAUSATIVES, 2, rng),
            relievingFactors: pickMultiple(RELIEVERS, 2, rng),
        },
        initialState: {
            pain,
            associatedSymptom: pick(SYMPTOMS, rng),
            symptomScale: `${Math.floor(rng() * 5 + 4) * 10}%`,
            frequency: Math.floor(rng() * 4),
            painTypes: pickMultiple(PAIN_TYPES_POOL, 2, rng),
        },
        seed
    }
}

// ========== 核心: 全链路 generate→text→parse→check ==========

interface AuditError {
    ruleId: string; severity: string; section: string; field: string
    message: string; visitIndex: number; expected?: string; actual?: string
}

interface AuditFailure {
    seed: number; score: number; grade: string; bp: string; pain: number
    errors: AuditError[]
}

function runFullPipeline(seed: number): AuditFailure | null {
    const { context, initialState } = generateRandomInput(seed)

    // Step 1: Generate TX sequence (same as engine-random.test.ts L140-143)
    const result = generateTXSequenceStates(context, {
        txCount: 11, startVisitIndex: 1, seed, initialState
    })
    const states = result.states

    // Step 2: Export to text (same as engine-random.test.ts L145-147)
    const ieCtx = { ...context, noteType: 'IE' as const }
    const ieText = exportSOAPAsText(ieCtx)
    const txTexts = states.map(s => exportSOAPAsText(context, s))

    // Step 3: Combine all texts and add fake header (same as checker.js L90-92)
    const fullText = ensureHeader([ieText, ...txTexts].join('\n\n'))

    // Step 4: Parse (same as checker.js L98)
    const parseResult = parseOptumNote(fullText)
    if (!parseResult.success || !parseResult.document) {
        return {
            seed, score: 0, grade: 'PARSE_FAIL', bp: context.primaryBodyPart, pain: initialState.pain,
            errors: [{
                ruleId: 'PARSE', severity: 'CRITICAL', section: '', field: 'parser',
                message: `Parse failed: ${parseResult.errors.map(e => e.message).join('; ')}`,
                visitIndex: 0
            }],
        }
    }

    // Step 5: Check (same as checker.js L104)
    const checkResult = checkDocument({ document: parseResult.document })

    if (checkResult.errors.length > 0) {
        return {
            seed, bp: context.primaryBodyPart, pain: initialState.pain,
            score: checkResult.summary.scoring.totalScore,
            grade: checkResult.summary.scoring.grade,
            errors: checkResult.errors.map(e => ({
                ruleId: e.ruleId, severity: e.severity, section: e.section,
                field: e.field, message: e.message, visitIndex: e.visitIndex,
                expected: e.expected, actual: e.actual,
            })),
        }
    }
    return null
}

// ========== 测试 ==========

const AUDIT_N = process.env.AUDIT_SEED_COUNT ? parseInt(process.env.AUDIT_SEED_COUNT, 10) : 20
const AUDIT_SEEDS = Array.from({ length: AUDIT_N }, (_, i) => i * 7919 + 42)

describe(`E2E Score Audit (${AUDIT_N} seeds)`, () => {
    it(`full pipeline: generate→text→parse→check`, () => {
        const failures: AuditFailure[] = []

        for (const seed of AUDIT_SEEDS) {
            try {
                const result = runFullPipeline(seed)
                if (result) failures.push(result)
            } catch (e) {
                failures.push({
                    seed, score: 0, grade: 'CRASH', bp: '?', pain: 0,
                    errors: [{
                        ruleId: 'CRASH', severity: 'CRITICAL', section: '', field: '',
                        message: (e as Error).message, visitIndex: 0
                    }],
                })
            }
        }

        // 汇总报告
        if (failures.length > 0) {
            const ruleCount: Record<string, number> = {}
            const ruleSevCount: Record<string, Record<string, number>> = {}
            const ruleExamples: Record<string, { message: string; expected?: string; actual?: string; seed: number; visitIndex: number }[]> = {}

            for (const f of failures) {
                for (const e of f.errors) {
                    ruleCount[e.ruleId] = (ruleCount[e.ruleId] || 0) + 1
                    if (!ruleSevCount[e.ruleId]) ruleSevCount[e.ruleId] = {}
                    ruleSevCount[e.ruleId][e.severity] = (ruleSevCount[e.ruleId][e.severity] || 0) + 1
                    if (!ruleExamples[e.ruleId]) ruleExamples[e.ruleId] = []
                    if (ruleExamples[e.ruleId].length < 3) {
                        ruleExamples[e.ruleId].push({
                            message: e.message, expected: e.expected, actual: e.actual,
                            seed: f.seed, visitIndex: e.visitIndex,
                        })
                    }
                }
            }

            const scores = failures.map(f => f.score)
            const minScore = Math.min(...scores)
            const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)

            console.log('\n========== E2E Score Audit 结果 ==========')
            console.log(`Seeds: ${AUDIT_N} | Failed: ${failures.length} (${(failures.length / AUDIT_N * 100).toFixed(1)}%)`)
            console.log(`Score range: ${minScore} ~ ${Math.max(...scores)}, avg: ${avgScore}`)

            console.log('\n--- 规则扣分排名 (发生次数) ---')
            const sorted = Object.entries(ruleCount).sort((a, b) => b[1] - a[1])
            console.table(sorted.map(([ruleId, count]) => ({
                ruleId, count,
                severities: Object.entries(ruleSevCount[ruleId]).map(([s, c]) => `${s}:${c}`).join(', ')
            })))

            console.log('\n--- 各规则示例 (前 3) ---')
            for (const [ruleId, examples] of Object.entries(ruleExamples)) {
                console.log(`\n[${ruleId}] × ${ruleCount[ruleId]}:`)
                for (const e of examples) {
                    console.log(`  seed=${e.seed} TX${e.visitIndex}: ${e.message}`)
                    if (e.expected || e.actual) console.log(`    exp="${e.expected}" act="${e.actual}"`)
                }
            }

            console.log('\n--- 最低 5 分详细 ---')
            const worst = failures.sort((a, b) => a.score - b.score).slice(0, 5)
            for (const f of worst) {
                console.log(`\nseed=${f.seed} bp=${f.bp} pain=${f.pain} score=${f.score} errors=${f.errors.length}`)
                for (const e of f.errors.slice(0, 15)) {
                    console.log(`  [${e.ruleId}] TX${e.visitIndex} ${e.section}.${e.field}: ${e.message}`)
                }
                if (f.errors.length > 15) console.log(`  ... +${f.errors.length - 15} more`)
            }
        } else {
            console.log(`\n✓ E2E Audit: ${AUDIT_N} seeds — ALL score=100`)
        }

        // 不断言失败——我们只需要报告
        console.log('\n[AUDIT COMPLETE]')
    })
})
