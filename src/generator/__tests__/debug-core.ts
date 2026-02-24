import { exportTXSeriesAsText } from '../soap-generator'
import { snapPainToGrid } from '../tx-sequence-engine'

const ctx = {
  noteType: 'TX' as const,
  insuranceType: 'OPTUM',
  primaryBodyPart: 'LBP',
  laterality: 'bilateral',
  localPattern: 'Qi Stagnation',
  systemicPattern: 'Kidney Yang Deficiency',
  chronicityLevel: 'Chronic',
  severityLevel: 'moderate to severe',
  painCurrent: 8,
  associatedSymptom: 'soreness',
}

const results = exportTXSeriesAsText(ctx as any, {
  txCount: 20,
  seed: 42,
  initialState: { pain: 8, associatedSymptom: 'soreness' },
})

// 提取 ROM/Strength 从文本
function extractRomStrength(text: string): string {
  const lines = text.split('\n')
  const romLines = lines.filter(l => l.match(/^\d\/5|^[345][\-\+]?\/5/))
  return romLines.map(l => l.trim().substring(0, 40)).join(' | ')
}

let sameCount = 0
for (let i = 0; i < results.length; i++) {
  const s = results[i].state
  const painLabel = snapPainToGrid(s.painScaleCurrent).label
  const tenderMatch = s.tendernessGrading.match(/\(\+?(\d)\)/)
  const spasmMatch = s.spasmGrading.match(/\(\+?(\d)\)/)
  const rom = extractRomStrength(results[i].text)

  const changes: string[] = []
  if (i > 0) {
    const p = results[i-1].state
    if (snapPainToGrid(s.painScaleCurrent).label !== snapPainToGrid(p.painScaleCurrent).label) changes.push('Pain')
    if (s.symptomScale !== p.symptomScale) changes.push('Sym%')
    if (s.tightnessGrading !== p.tightnessGrading) changes.push('Tight')
    if (s.tendernessGrading !== p.tendernessGrading) changes.push('Tender')
    if (s.spasmGrading !== p.spasmGrading) changes.push('Spasm')
    if (s.painFrequency !== p.painFrequency) changes.push('Freq')
    const prevRom = extractRomStrength(results[i-1].text)
    if (rom !== prevRom) changes.push('ROM/ST')
  }

  const tag = i === 0 ? 'FIRST' : changes.length === 0 ? '← SAME' : `Δ ${changes.join(', ')}`
  if (i > 0 && changes.length === 0) sameCount++
  console.log(`V${String(i+1).padStart(2)} | ${painLabel.padEnd(4)} | ${(s.symptomScale||'').padEnd(8)} | ${s.tightnessGrading.padEnd(20)} | +${tenderMatch?.[1]} | +${spasmMatch?.[1]} | ${s.painFrequency.substring(0,11).padEnd(11)} | ${tag}`)
}
console.log(`\n完全相同: ${sameCount}/19`)
