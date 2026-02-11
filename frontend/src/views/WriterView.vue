<script setup>
import { ref, reactive, computed } from 'vue'
import whitelist from '../data/whitelist.json'
import { TEMPLATE_ONLY_RULES } from '../../../src/parser/template-logic-rules.ts'
import { generateTXSequenceStates } from '../../../src/generator/tx-sequence-engine.ts'
import { exportSOAPAsText } from '../../../src/generator/soap-generator.ts'

// 选择器
const insuranceType = ref('OPTUM')
const bodyPart = ref('LBP')
const cptCode = ref('97810')
const noteType = ref('IE')
const txCount = ref(3)

const INSURANCE_OPTIONS = ['OPTUM', 'HF', 'WC', 'VC', 'ELDERPLAN', 'NONE']
const BODY_PARTS = ['LBP', 'NECK', 'SHOULDER', 'KNEE', 'ELBOW', 'HIP']
const CPT_OPTIONS = [{ value: '97810', label: '97810' }, { value: 'full', label: 'Full Code' }]

// 固定字段（不显示，由引擎自动处理）
const FIXED_FIELDS = new Set([
  'subjective.painTypes',
  'subjective.chronicityLevel',
  'assessment.tcmDiagnosis.localPattern',
  'assessment.tcmDiagnosis.systemicPattern',
  'assessment.generalCondition',
  'assessment.treatmentPrinciples.focusOn',
  'objective.tonguePulse.tongue',
  'objective.tonguePulse.pulse',
  'objective.muscleTesting.muscles',
  'plan.evaluationType',
  'plan.shortTermGoal.treatmentFrequency',
  'plan.needleProtocol.totalTime',
  'plan.needleProtocol.electricalStimulation',
  'plan.needleProtocol.points',
])

// 字段中文名称映射
const FIELD_LABELS = {
  'subjective.symptomScale': '症状量表',
  'subjective.symptomDuration.value': '病程时长',
  'subjective.symptomDuration.unit': '时长单位',
  'subjective.adlDifficulty.level': 'ADL难度',
  'subjective.adlDifficulty.activities': 'ADL活动',
  'subjective.painScale.worst': '最痛评分',
  'subjective.painScale.best': '最轻评分',
  'subjective.painScale.current': '当前评分',
  'subjective.painFrequency': '疼痛频率',
  'subjective.painRadiation': '放射痛',
  'subjective.associatedSymptoms': '伴随症状',
  'subjective.causativeFactors': '病因',
  'subjective.exacerbatingFactors': '加重因素',
  'subjective.relievingFactors': '缓解因素',
  'subjective.symptomChange': '症状变化',
  'subjective.reasonConnector': '连接词',
  'subjective.reason': '原因',
  'subjective.painScale': '疼痛评分',
  'objective.muscleTesting.tightness.gradingScale': '紧张度',
  'objective.muscleTesting.tenderness.gradingScale': '压痛度',
  'objective.spasmGrading': '痉挛度',
  'objective.rom.degrees': 'ROM角度',
  'objective.rom.strength': '肌力',
}

// 动态字段值
const fields = reactive({})

// 初始化字段默认值
Object.keys(whitelist).forEach(key => {
  const opts = whitelist[key]
  fields[key] = Array.isArray(opts) && opts.length > 0 ? opts[0] : ''
})

// 根据规则计算推荐选项
function getRecommendedOptions(fieldPath) {
  const recommendations = []
  for (const rule of TEMPLATE_ONLY_RULES) {
    const conditionsMet = rule.conditions.every(cond => {
      const val = getNestedValue(fields, cond.field)
      if (cond.operator === 'equals') return val === cond.value
      if (cond.operator === 'gte') return Number(val) >= Number(cond.value)
      if (cond.operator === 'lte') return Number(val) <= Number(cond.value)
      return false
    })
    if (!conditionsMet) continue
    for (const effect of rule.effects) {
      if (effect.targetField === fieldPath) {
        recommendations.push(...effect.options.map(o => ({ option: o, weight: effect.weightChange, reason: effect.reason })))
      }
    }
  }
  return recommendations.sort((a, b) => b.weight - a.weight)
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj)
}

// 动态字段分组（过滤掉固定字段）
const dynamicFields = computed(() => ({
  S: Object.keys(whitelist).filter(k => k.startsWith('subjective.') && !FIXED_FIELDS.has(k)),
  O: Object.keys(whitelist).filter(k => k.startsWith('objective.') && !FIXED_FIELDS.has(k)),
  A: [], // A部分由引擎自动推导
  P: []  // P部分由证型决定
}))

// 生成上下文
const generationContext = computed(() => ({
  noteType: noteType.value,
  insuranceType: insuranceType.value,
  primaryBodyPart: bodyPart.value,
  laterality: 'bilateral',
  localPattern: fields['assessment.tcmDiagnosis.localPattern'] || 'Qi Stagnation',
  systemicPattern: fields['assessment.tcmDiagnosis.systemicPattern'] || 'Kidney Yang Deficiency',
  chronicityLevel: fields['subjective.chronicityLevel'] || 'Chronic',
  severityLevel: fields['subjective.adlDifficulty.level'] || 'moderate'
}))

// 生成结果
const generatedNotes = ref([])
const copiedIndex = ref(-1)

function generate() {
  if (noteType.value === 'IE') {
    // IE 模式：生成 IE + 11个 TX
    const ieText = exportSOAPAsText(generationContext.value, {})
    const states = generateTXSequenceStates(generationContext.value, {
      txCount: 11,
      startVisitIndex: 1
    })
    generatedNotes.value = [
      { visitIndex: 0, text: ieText, type: 'IE' },
      ...states.map(state => ({
        visitIndex: state.visitIndex,
        text: exportSOAPAsText(generationContext.value, state),
        type: 'TX'
      }))
    ]
  } else {
    const states = generateTXSequenceStates(generationContext.value, {
      txCount: txCount.value,
      startVisitIndex: 1
    })
    generatedNotes.value = states.map(state => ({
      visitIndex: state.visitIndex,
      text: exportSOAPAsText(generationContext.value, state),
      type: 'TX'
    }))
  }
}

function copyNote(idx) {
  navigator.clipboard.writeText(generatedNotes.value[idx]?.text || '')
  copiedIndex.value = idx
  setTimeout(() => copiedIndex.value = -1, 1500)
}

function copyAll() {
  const all = generatedNotes.value.map(n => `=== ${n.type}${n.visitIndex || ''} ===\n${n.text}`).join('\n\n')
  navigator.clipboard.writeText(all)
  copiedIndex.value = -999
  setTimeout(() => copiedIndex.value = -1, 1500)
}

function fieldLabel(path) {
  return FIELD_LABELS[path] || path.split('.').pop().replace(/([A-Z])/g, ' $1').trim()
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-8">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- 左栏: 选择器 + 动态字段 -->
      <div class="lg:col-span-5 space-y-4">
        <!-- 基础设置 -->
        <div class="bg-white rounded-xl border border-ink-200 p-4 space-y-3">
          <h2 class="text-sm font-semibold text-ink-700">基础设置</h2>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-ink-500 mb-1 block">保险类型</label>
              <select v-model="insuranceType" class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm">
                <option v-for="t in INSURANCE_OPTIONS" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-ink-500 mb-1 block">部位</label>
              <select v-model="bodyPart" class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm">
                <option v-for="p in BODY_PARTS" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-ink-500 mb-1 block">CPT Code</label>
              <select v-model="cptCode" class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm">
                <option v-for="c in CPT_OPTIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-ink-500 mb-1 block">笔记类型</label>
              <select v-model="noteType" class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm">
                <option value="IE">IE (初诊)</option>
                <option value="TX">TX (复诊)</option>
              </select>
            </div>
          </div>
          <div v-if="noteType === 'TX'" class="flex items-center gap-2">
            <label class="text-xs text-ink-500">TX数量:</label>
            <input type="number" v-model.number="txCount" min="1" max="11" class="w-16 px-2 py-1 border border-ink-200 rounded text-sm text-center" />
          </div>
        </div>

        <!-- 动态字段（仅显示用户可控字段） -->
        <div v-for="(section, key) in { S: 'Subjective', O: 'Objective' }" :key="key"
          class="bg-white rounded-xl border border-ink-200 p-4"
          v-show="dynamicFields[key].length > 0">
          <h3 class="text-sm font-semibold text-ink-700 mb-3">{{ section }} <span class="text-ink-400 font-normal">({{ dynamicFields[key].length }})</span></h3>
          <div class="space-y-2 max-h-56 overflow-y-auto">
            <div v-for="fieldPath in dynamicFields[key]" :key="fieldPath" class="flex items-center gap-2">
              <label class="text-xs text-ink-500 w-24 truncate" :title="fieldPath">{{ fieldLabel(fieldPath) }}</label>
              <select v-model="fields[fieldPath]" class="flex-1 px-2 py-1 border border-ink-200 rounded text-xs">
                <option v-for="opt in whitelist[fieldPath]" :key="opt" :value="opt">{{ opt.length > 40 ? opt.substring(0, 40) + '...' : opt }}</option>
              </select>
              <span v-if="getRecommendedOptions(fieldPath).length" class="text-xs text-green-600" title="有推荐">✓</span>
            </div>
          </div>
        </div>

        <!-- A/P 说明 -->
        <div class="bg-paper-100 rounded-xl border border-ink-100 p-3 text-xs text-ink-500">
          <p>💡 Assessment 和 Plan 由引擎根据 S/O 自动推导生成</p>
        </div>

        <!-- 生成按钮 -->
        <button @click="generate" class="w-full py-2.5 bg-ink-800 text-paper-50 rounded-lg text-sm font-medium hover:bg-ink-700 transition-colors">
          生成 {{ noteType === 'TX' ? `${txCount} 个 TX` : 'IE' }}
        </button>
      </div>

      <!-- 右栏: 结果 -->
      <div class="lg:col-span-7 space-y-3">
        <div v-if="generatedNotes.length === 0" class="bg-white rounded-xl border border-ink-200 p-8 text-center text-ink-400 text-sm">
          选择参数并点击生成
        </div>
        <div v-else>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-ink-700">生成结果 ({{ generatedNotes.length }})</h2>
            <button @click="copyAll" class="px-3 py-1.5 text-xs border border-ink-200 rounded-lg hover:bg-paper-100">
              {{ copiedIndex === -999 ? '✓ 已复制' : '复制全部' }}
            </button>
          </div>
          <div v-for="(note, idx) in generatedNotes" :key="idx" class="bg-white rounded-xl border border-ink-200 mb-3">
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-ink-100 cursor-pointer" @click="note._open = !note._open">
              <span class="text-xs font-mono bg-ink-100 text-ink-600 px-2 py-0.5 rounded">{{ note.type }}{{ note.visitIndex || '' }}</span>
              <div class="flex items-center gap-2">
                <button @click.stop="copyNote(idx)" class="px-2.5 py-1 text-xs border border-ink-200 rounded hover:bg-paper-100">
                  {{ copiedIndex === idx ? '✓' : '复制' }}
                </button>
                <svg class="w-4 h-4 text-ink-400 transition-transform" :class="{ 'rotate-180': note._open }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div v-show="note._open" class="p-4">
              <pre class="text-xs font-mono text-ink-700 whitespace-pre-wrap leading-relaxed">{{ note.text }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
