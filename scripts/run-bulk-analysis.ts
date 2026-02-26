/**
 * 7 个部位 × 10 个随机 seed，综合分析引擎产出
 */
import { generateTXSequenceStates } from '../src/generator/tx-sequence-engine'
import { exportSOAPAsText } from '../src/generator/soap-generator'
import { patchSOAPText } from '../src/generator/objective-patch'
import { normalizeGenerationContext, type NormalizeInput } from '../src/shared/normalize-generation-context'

const BODY_PARTS: Array<{
  bp: string; lat: string; pain: number; sev: string; symptom: string
  freq: string; painTypes: string[]; radiation: string; symptomScale: string
}> = [
  { bp: 'LBP', lat: 'unspecified', pain: 8, sev: 'moderate to severe', symptom: 'soreness', freq: 'Constant (symptoms occur between 76% and 100% of the time)', painTypes: ['Dull', 'Aching'], radiation: 'without radiation', symptomScale: '70%-80%' },
  { bp: 'NECK', lat: 'unspecified', pain: 7, sev: 'moderate', symptom: 'stiffness', freq: 'Constant (symptoms occur between 76% and 100% of the time)', painTypes: ['Dull', 'Aching'], radiation: 'without radiation', symptomScale: '70%-80%' },
  { bp: 'SHOULDER', lat: 'bilateral', pain: 7, sev: 'moderate', symptom: 'soreness', freq: 'Frequent (symptoms occur between 51% and 75% of the time)', painTypes: ['Aching', 'Stabbing'], radiation: 'without radiation', symptomScale: '60%-70%' },
  { bp: 'KNEE', lat: 'bilateral', pain: 8, sev: 'moderate to severe', symptom: 'stiffness', freq: 'Constant (symptoms occur between 76% and 100% of the time)', painTypes: ['Dull', 'Aching'], radiation: 'without radiation', symptomScale: '70%-80%' },
  { bp: 'HIP', lat: 'left', pain: 7, sev: 'moderate', symptom: 'soreness', freq: 'Frequent (symptoms occur between 51% and 75% of the time)', painTypes: ['Dull', 'Aching'], radiation: 'without radiation', symptomScale: '60%-70%' },
  { bp: 'ELBOW', lat: 'right', pain: 6, sev: 'moderate', symptom: 'soreness', freq: 'Frequent (symptoms occur between 51% and 75% of the time)', painTypes: ['Aching', 'Burning'], radiation: 'without radiation', symptomScale: '60%-70%' },
  { bp: 'WRIST', lat: 'right', pain: 6, sev: 'moderate', symptom: 'soreness', freq: 'Frequent (symptoms occur between 51% and 75% of the time)', painTypes: ['Aching', 'Tingling'], radiation: 'without radiation', symptomScale: '60%-70%' },
]

const SEEDS = [42, 123, 456, 789, 1001, 2024, 3333, 5555, 7777, 9999]

// 提取关键指标
function extractMetrics(text: string, state: any) {
  const lines = text.split('\n')
  const painMatch = lines.find(l => l.includes('Pain Scale:'))?.match(/Pain Scale:\s*([^\s/]+)/)
  const freqLine = lines.find(l => /[Pp]ain [Ff]requency:/.test(l)) || ''
  const freq = freqLine.includes('Constant') ? 'Const' : freqLine.includes('Frequent') ? 'Freq' : freqLine.includes('Occasional') ? 'Occ' : freqLine.includes('Intermittent') ? 'Int' : '?'
  const symptomPct = lines.find(l => l.includes('scale as'))?.match(/scale as ([^)]+)/)?.[1] || ''

  // ADL
  const adlMatches = [...text.matchAll(/(severe|moderate to severe|moderate|mild to moderate|mild)\s+difficulty/g)]
  const adlA = adlMatches[0]?.[1] || ''
  const adlB = adlMatches[1]?.[1] || ''

  // O
  const tightness = state.tightnessGrading || ''
  const tenderness = state.tendernessGrading?.match(/\(\+?(\d)\)/)?.[1] || ''
  const spasm = state.spasmGrading?.match(/\(\+?(\d)\)/)?.[1] || ''

  // ROM + Strength (first line)
  const romLine = lines.find(l => /^\d[+-]?\/5\s/.test(l)) || ''
  const strMatch = romLine.match(/^(\d[+-]?\/5)/)
  const romMatch = romLine.match(/:\s*(\d+)/)

  // S report
  const report = lines.find(l => l.includes('Patient reports:')) || ''
  const changeMatch = report.match(/there is (improvement of symptom|improvement after treatment|similar symptom|exacerbate)/)
  const reasonMatch = report.match(/(?:because of|may related of|due to|and)\s+(.+?)\s*\./)

  // A
  const aIdx = lines.findIndex(l => l.startsWith('Assessment'))
  const pIdx = lines.findIndex(l => l.startsWith('Plan'))
  const aText = aIdx >= 0 && pIdx >= 0 ? lines.slice(aIdx + 1, pIdx).join(' ').trim() : ''
  const aPresent = aText.match(/presents with\s+([^.]+)/)?.[1] || ''

  return {
    pain: painMatch?.[1] || '',
    freq,
    symptomPct,
    adlA: adlA.replace('moderate to severe', 'mod-sev').replace('mild to moderate', 'mild-mod'),
    adlB: adlB ? adlB.replace('moderate to severe', 'mod-sev').replace('mild to moderate', 'mild-mod') : '',
    tightness: tightness.replace('Moderate to severe', 'Mod-sev').replace('Mild to moderate', 'Mild-mod'),
    tenderness,
    spasm,
    strength: strMatch?.[1] || '',
    rom: romMatch?.[1] || '',
    change: changeMatch?.[1]?.substring(0, 12) || '',
    reason: reasonMatch?.[1]?.substring(0, 30) || '',
    aPresent: aPresent.substring(0, 30),
  }
}

// 统计
interface Stats {
  bp: string
  totalRuns: number
  painReachedST: number
  freqChanged: number
  symptomReachedST: number
  adlChanged: number
  adlBUsed: number
  tightnessChanged: number
  tendernessChanged: number
  spasmChanged: number
  romChanged: number
  strengthChanged: number
  strengthRegressed: number
  spasmRegressed: number
  reasonRepeatRate: number
  changeVariety: number
  soaConflicts: number
  avgVisitsToFirstChange: Record<string, number[]>
}

const allStats: Stats[] = []

for (const bpDef of BODY_PARTS) {
  const stats: Stats = {
    bp: bpDef.bp, totalRuns: 0,
    painReachedST: 0, freqChanged: 0, symptomReachedST: 0,
    adlChanged: 0, adlBUsed: 0,
    tightnessChanged: 0, tendernessChanged: 0, spasmChanged: 0,
    romChanged: 0, strengthChanged: 0, strengthRegressed: 0, spasmRegressed: 0,
    reasonRepeatRate: 0, changeVariety: 0, soaConflicts: 0,
    avgVisitsToFirstChange: {},
  }

  for (const seed of SEEDS) {
    const input: NormalizeInput = {
      noteType: 'IE', insuranceType: 'HF',
      primaryBodyPart: bpDef.bp as any, laterality: bpDef.lat as any,
      painCurrent: bpDef.pain, severityLevel: bpDef.sev as any,
      chronicityLevel: 'Chronic', painWorst: bpDef.pain + 1, painBest: bpDef.pain - 3,
      associatedSymptom: bpDef.symptom as any, associatedSymptoms: [bpDef.symptom],
      symptomDuration: { value: '3', unit: 'year(s)' }, painRadiation: bpDef.radiation,
      recentWorse: { value: '1', unit: 'week(s)' }, painTypes: bpDef.painTypes,
      symptomScale: bpDef.symptomScale, painFrequency: bpDef.freq,
      causativeFactors: ['age related/degenerative changes'],
      relievingFactors: ['Changing positions', 'Resting'],
      age: 55, gender: 'Female', secondaryBodyParts: [], medicalHistory: ['Hypertension'],
    }

    try {
      const { context, initialState } = normalizeGenerationContext(input)
      const txCtx = { ...context, noteType: 'TX' as const }
      const { states } = generateTXSequenceStates(txCtx, { txCount: 11, startVisitIndex: 1, seed, initialState })

      stats.totalRuns++

      // 收集每次 visit 的指标
      const visits = states.map(s => {
        const text = patchSOAPText(exportSOAPAsText(txCtx, s), txCtx as any, s)
        return { ...extractMetrics(text, s), progress: (s as any).progress }
      })

      // Pain 是否达到 ST
      const lastPain = parseFloat(visits[visits.length - 1].pain.split('-')[0])
      if (lastPain <= bpDef.pain - 3) stats.painReachedST++

      // Freq 是否变化
      if (visits.some(v => v.freq !== visits[0].freq)) stats.freqChanged++

      // Symptom% 变化
      const lastSym = parseInt(visits[visits.length - 1].symptomPct)
      if (lastSym <= 50) stats.symptomReachedST++

      // ADL 变化
      if (visits.some((v, i) => i > 0 && v.adlA !== visits[0].adlA)) stats.adlChanged++
      if (visits.some(v => v.adlB)) stats.adlBUsed++

      // O 指标变化
      if (visits.some((v, i) => i > 0 && v.tightness !== visits[0].tightness)) stats.tightnessChanged++
      if (visits.some((v, i) => i > 0 && v.tenderness !== visits[0].tenderness)) stats.tendernessChanged++
      if (visits.some((v, i) => i > 0 && v.spasm !== visits[0].spasm)) stats.spasmChanged++
      if (visits.some((v, i) => i > 0 && v.rom !== visits[0].rom)) stats.romChanged++
      if (visits.some((v, i) => i > 0 && v.strength !== visits[0].strength)) stats.strengthChanged++

      // 回退检测
      for (let i = 1; i < visits.length; i++) {
        const prev = visits[i - 1]
        const curr = visits[i]
        if (parseInt(curr.spasm) > parseInt(prev.spasm)) stats.spasmRegressed++
        // Strength 回退
        const ladder = ['3-/5', '3/5', '3+/5', '4-/5', '4/5', '4+/5', '5/5']
        const pi = ladder.indexOf(prev.strength)
        const ci = ladder.indexOf(curr.strength)
        if (pi >= 0 && ci >= 0 && ci < pi) stats.strengthRegressed++
      }

      // reason 重复率
      const reasons = visits.map(v => v.reason).filter(Boolean)
      const uniqueReasons = new Set(reasons)
      stats.reasonRepeatRate += 1 - (uniqueReasons.size / reasons.length)

      // symptomChange 多样性
      const changes = visits.map(v => v.change).filter(Boolean)
      stats.changeVariety += new Set(changes).size

      // S-O-A 冲突：soaChain.subjective.painChange 说 improved 但 O 全 stable 且 pain 未变
      for (let i = 1; i < states.length; i++) {
        const prev = states[i - 1]
        const curr = states[i]
        const chain = (curr as any).soaChain
        if (!chain) continue
        const oAllStable = chain.objective.tightnessTrend === 'stable' &&
          chain.objective.tendernessTrend === 'stable' &&
          chain.objective.spasmTrend === 'stable' &&
          chain.objective.romTrend === 'stable' &&
          chain.objective.strengthTrend === 'stable'
        const painUnchanged = curr.painScaleCurrent === prev.painScaleCurrent
        if (chain.subjective.painChange === 'improved' && oAllStable && painUnchanged) {
          stats.soaConflicts++
        }
      }
    } catch (e) {
      console.error(`ERROR: ${bpDef.bp} seed=${seed}: ${(e as Error).message}`)
    }
  }

  // 平均
  stats.reasonRepeatRate /= stats.totalRuns || 1
  stats.changeVariety /= stats.totalRuns || 1

  allStats.push(stats)
}

// 输出汇总
console.log('\n' + '='.repeat(100))
console.log('综合统计（7 部位 × 10 seeds = 70 runs）')
console.log('='.repeat(100))

console.log('\n## 指标变化覆盖率（/10 runs）')
console.log('| 部位 | Runs | Pain达ST | Freq变化 | Sym%达ST | ADL变化 | ADL-B用 | Tight变 | Tender变 | Spasm变 | ROM变 | Str变 |')
console.log('|------|------|---------|---------|---------|---------|---------|---------|---------|---------|-------|-------|')
for (const s of allStats) {
  console.log(`| ${s.bp.padEnd(8)} | ${s.totalRuns} | ${s.painReachedST}/10 | ${s.freqChanged}/10 | ${s.symptomReachedST}/10 | ${s.adlChanged}/10 | ${s.adlBUsed}/10 | ${s.tightnessChanged}/10 | ${s.tendernessChanged}/10 | ${s.spasmChanged}/10 | ${s.romChanged}/10 | ${s.strengthChanged}/10 |`)
}

console.log('\n## 异常回退次数（负面开关未开不应出现）')
console.log('| 部位 | Strength回退 | Spasm回退 |')
console.log('|------|-------------|----------|')
for (const s of allStats) {
  console.log(`| ${s.bp.padEnd(8)} | ${s.strengthRegressed} | ${s.spasmRegressed} |`)
}

console.log('\n## S-O-A 一致性')
console.log('| 部位 | S说improvement但O无变化 | reason重复率 | symptomChange种类(avg) |')
console.log('|------|----------------------|------------|---------------------|')
for (const s of allStats) {
  console.log(`| ${s.bp.padEnd(8)} | ${s.soaConflicts} | ${(s.reasonRepeatRate * 100).toFixed(0)}% | ${s.changeVariety.toFixed(1)} |`)
}

// 单个 case 详细输出（每部位第一个 seed）
console.log('\n\n' + '='.repeat(100))
console.log('各部位样本详情（seed=42）')
console.log('='.repeat(100))

for (const bpDef of BODY_PARTS) {
  const input: NormalizeInput = {
    noteType: 'IE', insuranceType: 'HF',
    primaryBodyPart: bpDef.bp as any, laterality: bpDef.lat as any,
    painCurrent: bpDef.pain, severityLevel: bpDef.sev as any,
    chronicityLevel: 'Chronic', painWorst: bpDef.pain + 1, painBest: bpDef.pain - 3,
    associatedSymptom: bpDef.symptom as any, associatedSymptoms: [bpDef.symptom],
    symptomDuration: { value: '3', unit: 'year(s)' }, painRadiation: bpDef.radiation,
    recentWorse: { value: '1', unit: 'week(s)' }, painTypes: bpDef.painTypes,
    symptomScale: bpDef.symptomScale, painFrequency: bpDef.freq,
    causativeFactors: ['age related/degenerative changes'],
    relievingFactors: ['Changing positions', 'Resting'],
    age: 55, gender: 'Female', secondaryBodyParts: [], medicalHistory: ['Hypertension'],
  }

  try {
    const { context, initialState } = normalizeGenerationContext(input)
    const txCtx = { ...context, noteType: 'TX' as const }
    const { states } = generateTXSequenceStates(txCtx, { txCount: 11, startVisitIndex: 1, seed: 42, initialState })

    console.log(`\n### ${bpDef.bp} (Pain ${bpDef.pain}, ${bpDef.lat})`)
    console.log('| V# | Pain | Freq | Sym% | ADL-A | ADL-B | Tight | Tend | Spasm | ROM | Str | Change | Reason |')
    console.log('|----|------|------|------|-------|-------|-------|------|-------|-----|-----|--------|--------|')

    for (const s of states) {
      const text = patchSOAPText(exportSOAPAsText(txCtx, s), txCtx as any, s)
      const m = extractMetrics(text, s)
      console.log(`| ${String(s.visitIndex).padStart(2)} | ${m.pain.padEnd(4)} | ${m.freq.padEnd(4)} | ${m.symptomPct.padEnd(7)} | ${m.adlA.padEnd(8)} | ${(m.adlB || '-').padEnd(8)} | ${m.tightness.substring(0, 8).padEnd(8)} | +${m.tenderness} | +${m.spasm} | ${m.rom.padEnd(3)}° | ${m.strength.padEnd(4)} | ${m.change.padEnd(12)} | ${m.reason.padEnd(28)} |`)
    }
  } catch (e) {
    console.error(`ERROR: ${bpDef.bp}: ${(e as Error).message}`)
  }
}
