<script setup>
import { ref, reactive } from 'vue'
import { generateContinuation } from '../../services/generator.js'

const inputText = ref('')
const insuranceType = ref('OPTUM')
const treatmentTime = ref(60)
const generateCount = ref(0)
const isGenerating = ref(false)
const result = reactive({ visits: [], parseSummary: null, error: null })
const copiedIndex = ref(-1)

const INSURANCE_OPTIONS = ['OPTUM', 'HF', 'WC', 'VC', 'ELDERPLAN', 'NONE']
const TIME_OPTIONS = [15, 30, 45, 60]

function doParse() {
  result.error = null
  result.visits = []
  result.parseSummary = null
  if (!inputText.value.trim()) return

  const r = generateContinuation(inputText.value, {
    insuranceType: insuranceType.value,
    treatmentTime: treatmentTime.value,
    generateCount: 0 // 0 = 只解析不生成
  })
  if (r.error) { result.error = r.error; return }
  result.parseSummary = r.parseSummary
  generateCount.value = r.parseSummary.toGenerate
}

function doGenerate() {
  isGenerating.value = true
  result.error = null
  result.visits = []
  try {
    const r = generateContinuation(inputText.value, {
      insuranceType: insuranceType.value,
      treatmentTime: treatmentTime.value,
      generateCount: generateCount.value
    })
    if (r.error) { result.error = r.error; return }
    result.visits = r.visits
    result.parseSummary = r.parseSummary
  } catch (e) {
    result.error = '生成失败: ' + (e.message || e)
  } finally {
    isGenerating.value = false
  }
}

function copyVisit(index) {
  const text = result.visits[index]?.text
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    copiedIndex.value = index
    setTimeout(() => { copiedIndex.value = -1 }, 1500)
  })
}

function copyAll() {
  const all = result.visits.map(v => `=== TX${v.visitIndex} ===\n${v.text}`).join('\n\n')
  navigator.clipboard.writeText(all).then(() => {
    copiedIndex.value = -999
    setTimeout(() => { copiedIndex.value = -1 }, 1500)
  })
}
</script>

<template>
  <div class="max-w-7xl w-full mx-auto px-6 py-8">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

      <!-- 左栏: 输入 + 参数 -->
      <div class="lg:col-span-5 space-y-4">
        <div class="bg-white rounded-xl border border-ink-200 p-4">
          <h2 class="text-sm font-semibold text-ink-700 mb-3">粘贴 IE + TX 文本</h2>
          <textarea
            v-model="inputText"
            @blur="doParse"
            class="w-full h-64 p-3 border border-ink-200 rounded-lg text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ink-300"
            placeholder="粘贴 IE+TX 或仅 TX 文本..."
          />
        </div>

        <!-- 参数面板 -->
        <div class="bg-white rounded-xl border border-ink-200 p-4 space-y-3">
          <h2 class="text-sm font-semibold text-ink-700">参数设置</h2>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-ink-500 mb-1 block">保险类型</label>
              <select v-model="insuranceType" @change="doParse"
                class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ink-300">
                <option v-for="t in INSURANCE_OPTIONS" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-ink-500 mb-1 block">治疗时间</label>
              <select v-model.number="treatmentTime" @change="doParse"
                class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ink-300">
                <option v-for="t in TIME_OPTIONS" :key="t" :value="t">{{ t }} min</option>
              </select>
            </div>
          </div>

          <!-- 推断模式提示 -->
          <div v-if="result.parseSummary?.inferred" class="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
            ⚠️ 仅 TX 模式：上下文由系统推断，无 ICD/CPT 输出
          </div>

          <!-- 解析摘要 -->
          <div v-if="result.parseSummary" class="bg-paper-100 rounded-lg p-3 text-xs space-y-1">
            <div class="flex justify-between">
              <span class="text-ink-500">部位</span>
              <span class="text-ink-800 font-medium">{{ result.parseSummary.laterality }} {{ result.parseSummary.bodyPart }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-ink-500">证型</span>
              <span class="text-ink-800 font-medium">{{ result.parseSummary.localPattern }}</span>
            </div>
            <div v-if="result.parseSummary.iePain" class="flex justify-between">
              <span class="text-ink-500">IE Pain</span>
              <span class="text-ink-800 font-medium">{{ result.parseSummary.iePain }}</span>
            </div>
            <div v-if="result.parseSummary.lastTxPain != null" class="flex justify-between">
              <span class="text-ink-500">{{ result.parseSummary.inferred ? '当前 TX Pain' : '最后 TX Pain' }}</span>
              <span class="text-ink-800 font-medium">{{ result.parseSummary.lastTxPain }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-ink-500">{{ result.parseSummary.inferred ? '推断 TX 序号' : '已有 TX' }}</span>
              <span class="text-ink-800 font-medium">{{ result.parseSummary.existingTxCount }}</span>
            </div>
            <div class="flex items-center justify-between pt-1 border-t border-ink-200">
              <span class="text-ink-500">生成数量</span>
              <input type="number" v-model.number="generateCount" min="1" :max="11 - result.parseSummary.existingTxCount"
                class="w-16 px-2 py-1 border border-ink-200 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-ink-300" />
            </div>
          </div>

          <!-- 错误 -->
          <div v-if="result.error" class="bg-status-error/10 text-status-error rounded-lg p-3 text-xs">
            {{ result.error }}
          </div>

          <!-- 生成按钮 -->
          <button
            @click="doGenerate"
            :disabled="!result.parseSummary || isGenerating || generateCount < 1"
            class="w-full py-2.5 bg-ink-800 text-paper-50 rounded-lg text-sm font-medium hover:bg-ink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {{ isGenerating ? '生成中...' : `生成 ${generateCount || 0} 个 TX` }}
          </button>
        </div>
      </div>

      <!-- 右栏: 结果 -->
      <div class="lg:col-span-7 space-y-3">
        <div v-if="result.visits.length === 0" class="bg-white rounded-xl border border-ink-200 p-8 text-center text-ink-400 text-sm">
          粘贴文本并点击生成，结果将显示在此处
        </div>

        <div v-else>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-ink-700">生成结果 ({{ result.visits.length }} 个 TX)</h2>
            <button @click="copyAll"
              class="px-3 py-1.5 text-xs border border-ink-200 rounded-lg hover:bg-paper-100 transition-colors">
              {{ copiedIndex === -999 ? '✓ 已复制' : '复制全部' }}
            </button>
          </div>

          <div v-for="(v, idx) in result.visits" :key="v.visitIndex"
            class="bg-white rounded-xl border border-ink-200 mb-3">
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-ink-100 cursor-pointer"
              @click="v._open = !v._open">
              <div class="flex items-center gap-3">
                <span class="text-xs font-mono bg-ink-100 text-ink-600 px-2 py-0.5 rounded">TX{{ v.visitIndex }}</span>
                <span class="text-xs text-ink-500">
                  Pain: {{ v.state.painScaleCurrent }} · {{ v.state.severityLevel }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <button @click.stop="copyVisit(idx)"
                  class="px-2.5 py-1 text-xs border border-ink-200 rounded hover:bg-paper-100 transition-colors">
                  {{ copiedIndex === idx ? '✓' : '复制' }}
                </button>
                <svg class="w-4 h-4 text-ink-400 transition-transform" :class="{ 'rotate-180': v._open }"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div v-show="v._open" class="p-4">
              <pre class="text-xs font-mono text-ink-700 whitespace-pre-wrap leading-relaxed">{{ v.text }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
