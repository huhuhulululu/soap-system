/**
 * AI SOAP 生成测试脚本
 *
 * 用法:
 *   npx tsx scripts/test-ai-generate.ts                    # 默认 SHOULDER IE
 *   npx tsx scripts/test-ai-generate.ts --body LBP         # LBP IE
 *   npx tsx scripts/test-ai-generate.ts --body KNEE --side left
 *   npx tsx scripts/test-ai-generate.ts --body NECK --type TX
 */

import { generateWithAI, type AIGenerateInput } from '../server/services/ai-generator'

const args = process.argv.slice(2)
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}

const presets: Record<string, Partial<AIGenerateInput>> = {
  SHOULDER: {
    bodyPart: 'SHOULDER',
    tcmLocal: 'Qi Stagnation, Blood Stasis',
    tcmSystemic: 'Blood Deficiency',
    associatedSymptoms: ['stiffness'],
    painTypes: ['Aching'],
    causativeFactors: ['repetitive strain from activities in the past'],
    aggravatingFactors: ['flexion', 'abduction', 'Overhead activities'],
    relievingFactors: ['rest'],
    tongue: 'pale, thin white coat',
    pulse: 'thin, choppy',
  },
  LBP: {
    bodyPart: 'LBP',
    tcmLocal: 'Cold-Damp + Wind-Cold',
    tcmSystemic: 'Kidney Yang Deficiency',
    associatedSymptoms: ['numbness'],
    painTypes: ['Stabbing'],
    causativeFactors: ['lifting heavy objects'],
    aggravatingFactors: ['Bending', 'Prolonged sitting', 'Twisting'],
    relievingFactors: ['Lying down'],
    tongue: 'thick, white coat',
    pulse: 'deep',
  },
  KNEE: {
    bodyPart: 'KNEE',
    tcmLocal: 'Wind-Damp-Heat',
    tcmSystemic: 'Liver Blood Deficiency',
    associatedSymptoms: ['swelling'],
    painTypes: ['Dull'],
    causativeFactors: ['climb too much stairs'],
    aggravatingFactors: ['Walking', 'Squatting', 'Going up stairs'],
    relievingFactors: ['rest'],
    tongue: 'yellow, sticky (red), thick coat',
    pulse: 'rolling rapid (forceful)',
  },
  NECK: {
    bodyPart: 'NECK',
    tcmLocal: 'Qi Stagnation, Blood Stasis',
    tcmSystemic: 'Liver Qi Stagnation',
    associatedSymptoms: ['stiffness', 'headache'],
    painTypes: ['Aching'],
    causativeFactors: ['prolonged computer use'],
    aggravatingFactors: ['Turning head', 'Looking up', 'Prolonged sitting'],
    relievingFactors: ['massage'],
    tongue: 'purple, thin white coat',
    pulse: 'string-taut',
  },
  ELBOW: {
    bodyPart: 'ELBOW',
    tcmLocal: 'Wind-Damp',
    tcmSystemic: 'Qi Deficiency',
    associatedSymptoms: ['soreness'],
    painTypes: ['Aching'],
    causativeFactors: ['repetitive strain from activities in the past'],
    aggravatingFactors: ['Gripping', 'Lifting', 'Twisting'],
    relievingFactors: ['rest'],
    tongue: 'pale, thin white coat',
    pulse: 'thin, weak',
  },
}

const bodyPart = getArg('body', 'SHOULDER').toUpperCase()
const laterality = getArg('side', 'right') as AIGenerateInput['laterality']
const noteType = getArg('type', 'IE') as AIGenerateInput['noteType']
const preset = presets[bodyPart] ?? presets.SHOULDER

const input = {
  noteType,
  bodyPart: (preset.bodyPart ?? bodyPart) as AIGenerateInput['bodyPart'],
  laterality,
  painCurrent: 7,
  painWorst: 9,
  painBest: 4,
  chronicityLevel: 'Chronic' as const,
  severityLevel: 'moderate to severe' as const,
  painFrequency: 'Frequent (symptoms occur between 51% and 75% of the time)',
  symptomScale: '60%-70%',
  duration: '5 year(s)',
  age: 60,
  gender: 'Female' as const,
  tcmLocal: preset.tcmLocal ?? '',
  tcmSystemic: preset.tcmSystemic ?? '',
  associatedSymptoms: preset.associatedSymptoms ?? [],
  painTypes: preset.painTypes ?? [],
  causativeFactors: preset.causativeFactors ?? [],
  aggravatingFactors: preset.aggravatingFactors ?? [],
  relievingFactors: preset.relievingFactors ?? [],
  tongue: preset.tongue,
  pulse: preset.pulse,
} satisfies AIGenerateInput

async function main() {
  console.log(`\n🔄 Generating ${noteType} SOAP for ${bodyPart} (${laterality})...\n`)
  console.log('Prompt:', JSON.stringify(input, null, 2).slice(0, 300), '...\n')

  const result = await generateWithAI(input)

  if (result.success) {
    console.log(`✅ Generated in ${result.elapsed}s\n`)
    console.log('─'.repeat(60))
    console.log(result.fullText)
    console.log('─'.repeat(60))
    console.log(`\nS: ${result.soap.subjective.length} chars`)
    console.log(`O: ${result.soap.objective.length} chars`)
    console.log(`A: ${result.soap.assessment.length} chars`)
    console.log(`P: ${result.soap.plan.length} chars`)
  } else {
    console.error(`❌ Failed: ${result.error}`)
    process.exit(1)
  }
}

main()
