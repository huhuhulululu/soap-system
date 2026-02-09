/**
 * 规则引擎演示脚本
 * 运行: npx ts-node scripts/demo-rule-engine.ts
 */

import {
  createContext,
  getWeightedOptions,
  selectTopOptions,
  generateRuleReport,
  generateFieldWeightDetail,
  applyRules,
  RULE_STATS
} from '../src'

console.log('=== SOAP 规则引擎演示 ===\n')
console.log(`规则统计: ${JSON.stringify(RULE_STATS, null, 2)}\n`)

// 场景1: 寒冷天气 + 老年患者 + 腰痛
console.log('\n--- 场景1: 寒冷天气老年腰痛患者 ---\n')

const context1 = createContext({
  insuranceType: 'WC',
  noteType: 'IE',
  bodyPart: 'LBP',
  localPattern: 'Wind-Cold Invasion',
  systemicPattern: 'Kidney Yang Deficiency',
  painScore: 7,
  chronicityLevel: 'Chronic',
  age: 68,
  weather: 'cold'
})

// 获取病因推荐
const causativeOptions = [
  'expose to the cold air for more than 20 mins',
  'live in too cold environment',
  'weather change',
  'age related/degenerative changes',
  'overworking in computer',
  'lifting too much weight',
  'recent sprain'
]

console.log('病因加权结果:')
const weightedCauses = getWeightedOptions('subjective.causativeFactors', causativeOptions, context1)
weightedCauses.forEach(w => {
  console.log(`  [${w.weight}] ${w.option}`)
  if (w.reasons.length > 0) {
    w.reasons.forEach(r => console.log(`      - ${r}`))
  }
})

// 获取疼痛类型推荐
const painOptions = ['Dull', 'Burning', 'Freezing', 'Shooting', 'Stabbing', 'Aching', 'weighty', 'cold']

console.log('\n疼痛类型加权结果:')
const weightedPain = getWeightedOptions('subjective.painTypes', painOptions, context1)
weightedPain.forEach(w => {
  console.log(`  [${w.weight}] ${w.option}`)
})

// 获取穴位推荐
const acupointOptions = ['BL23', 'BL25', 'BL40', 'DU4', 'GB30', 'ST36', 'LI4', 'GB20']

console.log('\n穴位加权结果:')
const weightedPoints = getWeightedOptions('plan.needleProtocol.acupoints', acupointOptions, context1)
weightedPoints.forEach(w => {
  console.log(`  [${w.weight}] ${w.option}`)
})

// 场景2: HF保险 + 起搏器患者
console.log('\n\n--- 场景2: HF保险 + 起搏器患者 ---\n')

const context2 = createContext({
  insuranceType: 'HF',
  noteType: 'TX',
  bodyPart: 'NECK',
  localPattern: 'Qi Stagnation',
  painScore: 5,
  chronicityLevel: 'Sub Acute',
  hasPacemaker: true,
  occupation: 'office'
})

// 电刺激选项
const eStimOptions = ['with', 'without']

console.log('电刺激加权结果 (起搏器禁忌):')
const weightedEStim = getWeightedOptions('plan.needleProtocol.electricalStimulation', eStimOptions, context2)
weightedEStim.forEach(w => {
  console.log(`  [${w.weight}] ${w.option}`)
  if (w.reasons.length > 0) {
    w.reasons.forEach(r => console.log(`      - ${r}`))
  }
})

// 治疗时间选项
const timeOptions = ['15', '30', '45', '60']

console.log('\n治疗时间加权结果 (HF保险限制):')
const weightedTime = getWeightedOptions('plan.needleProtocol.totalTime', timeOptions, context2)
weightedTime.forEach(w => {
  console.log(`  [${w.weight}] ${w.option}`)
  if (w.reasons.length > 0) {
    w.reasons.forEach(r => console.log(`      - ${r}`))
  }
})

// 场景3: 血瘀证 - 验证舌脉推荐
console.log('\n\n--- 场景3: 血瘀证舌脉推荐 ---\n')

const context3 = createContext({
  insuranceType: 'NONE',
  noteType: 'IE',
  bodyPart: 'SHOULDER',
  localPattern: 'Blood Stasis',
  painScore: 8,
  chronicityLevel: 'Chronic'
})

const tongueOptions = [
  'thin white coat',
  'purple',
  'purple dark',
  'purple spots on side',
  'pale',
  'red, little coat',
  'yellow, sticky (red), thick coat'
]

console.log('舌象加权结果:')
const weightedTongue = getWeightedOptions('objective.tonguePulse.tongue', tongueOptions, context3)
weightedTongue.forEach(w => {
  console.log(`  [${w.weight}] ${w.option}`)
})

const pulseOptions = [
  'string-taut',
  'hesitant',
  'choppy',
  'deep',
  'rapid',
  'thready',
  'slippery'
]

console.log('\n脉象加权结果:')
const weightedPulse = getWeightedOptions('objective.tonguePulse.pulse', pulseOptions, context3)
weightedPulse.forEach(w => {
  console.log(`  [${w.weight}] ${w.option}`)
})

// 生成完整规则报告
console.log('\n\n--- 场景1完整规则报告 ---\n')
console.log(generateRuleReport(context1))

// 统计应用的规则数量
const effects1 = applyRules(context1)
const effects2 = applyRules(context2)
const effects3 = applyRules(context3)

console.log('\n=== 规则应用统计 ===')
console.log(`场景1 (老年腰痛): ${effects1.length} 个权重效果`)
console.log(`场景2 (HF+起搏器): ${effects2.length} 个权重效果`)
console.log(`场景3 (血瘀证): ${effects3.length} 个权重效果`)

console.log('\n演示完成!')
