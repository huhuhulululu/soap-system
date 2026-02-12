/**
 * 随机输入全面测试
 * 随机组合所有用户输入参数，验证：
 * 1. 输出是否采用了输入
 * 2. 纵向一致性（所有指标只降不升）
 * 3. SOA 链关联性（S/O/A 之间逻辑一致）
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { generateTXSequenceStates, type TXVisitState } from '../../src/generator/tx-sequence-engine'
import { exportSOAPAsText } from '../../src/generator/soap-generator'
import { setWhitelist } from '../../src/parser/template-rule-whitelist.browser'
import whitelistData from './data/whitelist.json'

beforeAll(() => {
  setWhitelist(whitelistData)
})

// ========== 随机输入生成器 ==========

const BODY_PARTS_IE = ['LBP', 'NECK', 'SHOULDER', 'KNEE', 'ELBOW', 'HIP'] as const
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

function generateRandomInput(seed: number) {
  const rng = mulberry32(seed)
  const pain = Math.floor(rng() * 8) + 3 // 3-10
  const bp = pick(BODY_PARTS_TX, rng) // TX 支持的部位
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
      symptomScale: `${Math.floor(rng() * 5 + 4) * 10}%`, // 40%-80%
      frequency: Math.floor(rng() * 4), // 0-3
      painTypes: pickMultiple(PAIN_TYPES_POOL, 2, rng),
    },
    seed
  }
}

function severityFromPain(pain: number) {
  if (pain >= 9) return 'severe' as const
  if (pain >= 7) return 'moderate to severe' as const
  if (pain >= 6) return 'moderate' as const
  if (pain >= 4) return 'mild to moderate' as const
  return 'mild' as const
}

// ========== 辅助验证函数 ==========

const SEVERITY_ORDER = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']

function symptomRank(s: string): number {
  if (s.includes('numbness') || s.includes('weakness')) return 4
  if (s.includes('heaviness')) return 3
  if (s.includes('stiffness')) return 2
  if (s.includes('soreness')) return 1
  return 2
}

function extractSpasmLevel(grading: string): number {
  const m = grading.match(/\(([+]?\d)\)/)
  return m ? parseInt(m[1].replace('+', ''), 10) : -1
}

function extractFrequencyLevel(freq: string): number {
  if (freq.includes('Constant')) return 3
  if (freq.includes('Frequent')) return 2
  if (freq.includes('Occasional')) return 1
  if (freq.includes('Intermittent')) return 0
  return 3
}

function extractSymptomPct(scale: string | undefined): number {
  if (!scale) return 100
  const m = scale.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 100
}

// ========== 测试 ==========

// 生成 20 组随机输入
const RANDOM_SEEDS = Array.from({ length: 20 }, (_, i) => i * 7919 + 42)

describe('随机输入测试 (20 组)', () => {

  for (const testSeed of RANDOM_SEEDS) {
    const { context, initialState, seed } = generateRandomInput(testSeed)
    const label = `seed=${testSeed} bp=${context.primaryBodyPart} pain=${initialState.pain} lat=${context.laterality}`

    describe(label, () => {
      let states: TXVisitState[]
      let ieText: string
      let txTexts: string[]

      beforeAll(() => {
        const result = generateTXSequenceStates(context, {
          txCount: 11, startVisitIndex: 1, seed, initialState
        })
        states = result.states

        const ieCtx = { ...context, noteType: 'IE' as const }
        ieText = exportSOAPAsText(ieCtx)
        txTexts = states.map(s => exportSOAPAsText(context, s))
      })

      // ===== 1. 输入采用验证 =====

      it('IE 文本包含用户输入的 Pain Scale', () => {
        expect(ieText).toContain(`Current: ${initialState.pain}`)
      })

      it('IE 文本包含用户输入的 Duration', () => {
        expect(ieText).toContain(`${context.symptomDuration!.value} ${context.symptomDuration!.unit}`)
      })

      it('IE 文本包含用户输入的 Radiation', () => {
        expect(ieText).toContain(context.painRadiation!)
      })

      it('IE 文本包含用户输入的 Causative Factors', () => {
        for (const cf of context.causativeFactors!) {
          expect(ieText).toContain(cf)
        }
      })

      it('IE 文本包含用户输入的 Relieving Factors', () => {
        for (const rf of context.relievingFactors!) {
          expect(ieText).toContain(rf)
        }
      })

      it('TX1 继承 associatedSymptom', () => {
        expect(states[0].associatedSymptom).toBe(initialState.associatedSymptom)
      })

      it('TX1 继承 painTypes', () => {
        expect(states[0].painTypes).toEqual(initialState.painTypes)
      })

      it('TX1 pain ≤ 输入 pain', () => {
        expect(states[0].painScaleCurrent).toBeLessThanOrEqual(initialState.pain)
      })

      it('TX1 symptomScale ≤ 输入 symptomScale', () => {
        const inputPct = extractSymptomPct(initialState.symptomScale)
        const tx1Pct = extractSymptomPct(states[0].symptomScale)
        expect(tx1Pct).toBeLessThanOrEqual(inputPct)
      })

      // ===== 2. 纵向一致性 =====

      it('Pain 纵向只降不升', () => {
        for (let i = 1; i < states.length; i++) {
          expect(states[i].painScaleCurrent).toBeLessThanOrEqual(states[i - 1].painScaleCurrent)
        }
      })

      it('Severity 纵向只降不升', () => {
        for (let i = 1; i < states.length; i++) {
          expect(SEVERITY_ORDER.indexOf(states[i].severityLevel))
            .toBeLessThanOrEqual(SEVERITY_ORDER.indexOf(states[i - 1].severityLevel))
        }
      })

      it('AssociatedSymptom 等级纵向只降不升', () => {
        for (let i = 1; i < states.length; i++) {
          expect(symptomRank(states[i].associatedSymptom))
            .toBeLessThanOrEqual(symptomRank(states[i - 1].associatedSymptom))
        }
      })

      it('Spasm 纵向只降不升', () => {
        for (let i = 1; i < states.length; i++) {
          expect(extractSpasmLevel(states[i].spasmGrading))
            .toBeLessThanOrEqual(extractSpasmLevel(states[i - 1].spasmGrading))
        }
      })

      it('Frequency 纵向只降不升', () => {
        for (let i = 1; i < states.length; i++) {
          expect(extractFrequencyLevel(states[i].painFrequency))
            .toBeLessThanOrEqual(extractFrequencyLevel(states[i - 1].painFrequency))
        }
      })

      it('SymptomScale 纵向只降不升', () => {
        for (let i = 1; i < states.length; i++) {
          expect(extractSymptomPct(states[i].symptomScale))
            .toBeLessThanOrEqual(extractSymptomPct(states[i - 1].symptomScale))
        }
      })

      it('Progress 纵向只增不减', () => {
        for (let i = 1; i < states.length; i++) {
          expect(states[i].progress).toBeGreaterThanOrEqual(states[i - 1].progress)
        }
      })

      // ===== 3. SOA 链关联性 =====

      it('Severity 与 Pain 一致 (severity ≤ severityFromPain)', () => {
        // severity 可能因 ADL 额外降一档，所以 ≤ baseSeverity
        for (const s of states) {
          const baseSevIdx = SEVERITY_ORDER.indexOf(severityFromPain(s.painScaleCurrent))
          const actualSevIdx = SEVERITY_ORDER.indexOf(s.severityLevel)
          expect(actualSevIdx).toBeLessThanOrEqual(baseSevIdx)
        }
      })

      it('后期 symptomChange 倾向改善', () => {
        // progress > 0.7 的 TX 应该使用 improvement 表述
        const lateTX = states.filter(s => s.progress > 0.7)
        for (const s of lateTX) {
          expect(s.symptomChange.toLowerCase()).toContain('improvement')
        }
      })

      it('Assessment present 与 pain 变化方向一致', () => {
        for (let i = 0; i < states.length; i++) {
          const s = states[i]
          const present = s.soaChain.assessment.present.toLowerCase()
          // 所有 TX 都应包含 "improvement" (因为 pain 只降不升)
          expect(present).toContain('improvement')
        }
      })

      it('Assessment physicalChange 与 O 趋势一致', () => {
        for (const s of states) {
          const o = s.soaChain.objective
          const physChange = s.soaChain.assessment.physicalChange
          const anyObjImprove = o.romTrend !== 'stable' || o.strengthTrend !== 'stable' ||
            o.tightnessTrend !== 'stable' || o.tendernessTrend !== 'stable'
          if (anyObjImprove) {
            // O 有改善 → A 不应说 "remained the same"
            expect(physChange).not.toBe('remained the same')
          }
        }
      })

      it('Frequency chain: S frequency 改善 → A 提及 frequency', () => {
        for (const s of states) {
          if (s.soaChain.subjective.frequencyChange === 'improved') {
            expect(s.soaChain.assessment.whatChanged).toBe('pain frequency')
          }
        }
      })

      // ===== 4. 文本生成完整性 =====

      it('IE 文本包含 Subjective/Objective/Assessment/Plan 四段', () => {
        expect(ieText).toContain('Subjective')
        expect(ieText).toContain('Objective')
        expect(ieText).toContain('Assessment')
        expect(ieText).toContain('Plan')
      })

      it('所有 TX 文本包含四段且不为空', () => {
        for (const tx of txTexts) {
          expect(tx).toContain('Subjective')
          expect(tx).toContain('Objective')
          expect(tx).toContain('Assessment')
          expect(tx).toContain('Plan')
          expect(tx.length).toBeGreaterThan(200)
        }
      })

      it('TX 文本包含 Inspection', () => {
        for (const tx of txTexts) {
          expect(tx.toLowerCase()).toContain('inspection')
        }
      })

      it('TX 文本包含 tongue 和 pulse', () => {
        for (const tx of txTexts) {
          expect(tx.toLowerCase()).toContain('tongue')
          expect(tx.toLowerCase()).toContain('pulse')
        }
      })
    })
  }
})

// ========== Seed 可复现性 (跨随机输入) ==========
describe('Seed 跨输入可复现', () => {
  for (const testSeed of RANDOM_SEEDS.slice(0, 5)) {
    it(`seed=${testSeed} 两次生成结果完全一致`, () => {
      const { context, initialState, seed } = generateRandomInput(testSeed)
      const opts = { txCount: 11, startVisitIndex: 1, seed, initialState }
      const r1 = generateTXSequenceStates(context, opts)
      const r2 = generateTXSequenceStates(context, opts)
      expect(r1.seed).toBe(r2.seed)
      for (let i = 0; i < r1.states.length; i++) {
        expect(r1.states[i].painScaleLabel).toBe(r2.states[i].painScaleLabel)
        expect(r1.states[i].severityLevel).toBe(r2.states[i].severityLevel)
        expect(r1.states[i].painFrequency).toBe(r2.states[i].painFrequency)
        expect(r1.states[i].tightnessGrading).toBe(r2.states[i].tightnessGrading)
        expect(r1.states[i].tendernessGrading).toBe(r2.states[i].tendernessGrading)
        expect(r1.states[i].spasmGrading).toBe(r2.states[i].spasmGrading)
        expect(r1.states[i].associatedSymptom).toBe(r2.states[i].associatedSymptom)
        expect(r1.states[i].symptomScale).toBe(r2.states[i].symptomScale)
      }
    })
  }
})
