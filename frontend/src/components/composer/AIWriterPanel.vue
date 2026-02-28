<script setup>
import { ref, computed } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function csrfHeader() {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return m ? { 'x-csrf-token': m[1] } : {}
}

// ── Form Fields ─────────────────────────────────
const bodyPart = ref('SHOULDER')
const laterality = ref('right')
const noteType = ref('IE')
const painCurrent = ref(7)
const painWorst = ref(9)
const painBest = ref(4)
const chronicityLevel = ref('Chronic')
const severityLevel = ref('moderate to severe')
const age = ref(60)
const gender = ref('Female')
const painFrequency = ref('Frequent (symptoms occur between 51% and 75% of the time)')
const symptomScale = ref('60%-70%')
const duration = ref('5 year(s)')

// TCM
const tcmLocal = ref('')
const tcmSystemic = ref('')

// Symptoms
const associatedSymptoms = ref('stiffness')
const painTypes = ref('Aching')
const causativeFactors = ref('repetitive strain from activities in the past')
const aggravatingFactors = ref('flexion, abduction, Overhead activities')
const relievingFactors = ref('rest')
const tongue = ref('')
const pulse = ref('')

// ── Presets ──────────────────────────────────────
const presets = {
  SHOULDER: {
    tcmLocal: 'Qi Stagnation, Blood Stasis',
    tcmSystemic: 'Blood Deficiency',
    associatedSymptoms: 'stiffness',
    painTypes: 'Aching',
    causativeFactors: 'repetitive strain from activities in the past',
    aggravatingFactors: 'flexion, abduction, Overhead activities',
    relievingFactors: 'rest',
    tongue: 'pale, thin white coat',
    pulse: 'thin, choppy',
  },
  LBP: {
    tcmLocal: 'Cold-Damp + Wind-Cold',
    tcmSystemic: 'Kidney Yang Deficiency',
    associatedSymptoms: 'numbness',
    painTypes: 'Stabbing',
    causativeFactors: 'lifting heavy objects',
    aggravatingFactors: 'Bending, Prolonged sitting, Twisting',
    relievingFactors: 'Lying down',
    tongue: 'thick, white coat',
    pulse: 'deep',
  },
  KNEE: {
    tcmLocal: 'Wind-Damp-Heat',
    tcmSystemic: 'Liver Blood Deficiency',
    associatedSymptoms: 'swelling',
    painTypes: 'Dull',
    causativeFactors: 'climb too much stairs',
    aggravatingFactors: 'Walking, Squatting, Going up stairs',
    relievingFactors: 'rest',
    tongue: 'yellow, sticky (red), thick coat',
    pulse: 'rolling rapid (forceful)',
  },
  NECK: {
    tcmLocal: 'Qi Stagnation, Blood Stasis',
    tcmSystemic: 'Liver Qi Stagnation',
    associatedSymptoms: 'stiffness, headache',
    painTypes: 'Aching',
    causativeFactors: 'prolonged computer use',
    aggravatingFactors: 'Turning head, Looking up, Prolonged sitting',
    relievingFactors: 'massage',
    tongue: 'purple, thin white coat',
    pulse: 'string-taut',
  },
  ELBOW: {
    tcmLocal: 'Wind-Damp',
    tcmSystemic: 'Qi Deficiency',
    associatedSymptoms: 'soreness',
    painTypes: 'Aching',
    causativeFactors: 'repetitive strain from activities in the past',
    aggravatingFactors: 'Gripping, Lifting, Twisting',
    relievingFactors: 'rest',
    tongue: 'pale, thin white coat',
    pulse: 'thin, weak',
  },
}

function applyPreset() {
  const p = presets[bodyPart.value]
  if (!p) return
  tcmLocal.value = p.tcmLocal
  tcmSystemic.value = p.tcmSystemic
  associatedSymptoms.value = p.associatedSymptoms
  painTypes.value = p.painTypes
  causativeFactors.value = p.causativeFactors
  aggravatingFactors.value = p.aggravatingFactors
  relievingFactors.value = p.relievingFactors
  tongue.value = p.tongue
  pulse.value = p.pulse
}

// Apply initial preset
applyPreset()

// ── Generation ──────────────────────────────────
const isGenerating = ref(false)
const generatedText = ref('')
const generatedSOAP = ref(null)
const elapsed = ref(0)
const error = ref('')

const bodyParts = ['SHOULDER', 'LBP', 'KNEE', 'NECK', 'ELBOW', 'HIP', 'WRIST', 'ANKLE']
const lateralities = ['right', 'left', 'bilateral']
const chronicities = ['Acute', 'Sub Acute', 'Chronic']
const severities = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
const frequencies = [
  'Occasional (symptoms occur between 25% and 50% of the time)',
  'Frequent (symptoms occur between 51% and 75% of the time)',
  'Constant (symptoms occur between 76% and 100% of the time)',
]
const scales = ['30%-40%', '40%-50%', '50%-60%', '60%-70%', '70%-80%', '80%-90%']
const genders = ['Female', 'Male']

async function doGenerate() {
  isGenerating.value = true
  error.value = ''
  generatedText.value = ''
  generatedSOAP.value = null

  const payload = {
    noteType: noteType.value,
    bodyPart: bodyPart.value,
    laterality: laterality.value,
    painCurrent: painCurrent.value,
    painWorst: painWorst.value,
    painBest: painBest.value,
    chronicityLevel: chronicityLevel.value,
    severityLevel: severityLevel.value,
    tcmLocal: tcmLocal.value,
    tcmSystemic: tcmSystemic.value,
    associatedSymptoms: associatedSymptoms.value.split(',').map(s => s.trim()).filter(Boolean),
    painTypes: painTypes.value.split(',').map(s => s.trim()).filter(Boolean),
    painFrequency: painFrequency.value,
    symptomScale: symptomScale.value,
    duration: duration.value,
    causativeFactors: causativeFactors.value.split(',').map(s => s.trim()).filter(Boolean),
    aggravatingFactors: aggravatingFactors.value.split(',').map(s => s.trim()).filter(Boolean),
    relievingFactors: relievingFactors.value.split(',').map(s => s.trim()).filter(Boolean),
    tongue: tongue.value || undefined,
    pulse: pulse.value || undefined,
    age: age.value,
    gender: gender.value,
  }

  try {
    const res = await fetch(`${API_BASE}/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeader() },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.success) {
      generatedText.value = data.fullText
      generatedSOAP.value = data.soap
      elapsed.value = data.elapsed
    } else {
      error.value = data.error || 'Generation failed'
    }
  } catch (e) {
    error.value = e.message || 'Network error'
  } finally {
    isGenerating.value = false
  }
}

const copiedFull = ref(false)
function copyFullText() {
  navigator.clipboard.writeText(generatedText.value)
  copiedFull.value = true
  setTimeout(() => { copiedFull.value = false }, 2000)
}

function copySection(key) {
  if (!generatedSOAP.value) return
  navigator.clipboard.writeText(generatedSOAP.value[key])
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-6 space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-2">
      <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span class="text-xs text-ink-400">Vertex AI Fine-tuned Model (v2)</span>
    </div>

    <!-- Form Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <!-- Body Part -->
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Body Part</label>
        <select v-model="bodyPart" @change="applyPreset()"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg bg-white">
          <option v-for="bp in bodyParts" :key="bp" :value="bp">{{ bp }}</option>
        </select>
      </div>

      <!-- Laterality -->
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Laterality</label>
        <select v-model="laterality" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg bg-white">
          <option v-for="l in lateralities" :key="l" :value="l">{{ l }}</option>
        </select>
      </div>

      <!-- Note Type -->
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Note Type</label>
        <select v-model="noteType" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg bg-white">
          <option value="IE">IE</option>
          <option value="TX">TX</option>
        </select>
      </div>

      <!-- Gender -->
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Gender</label>
        <select v-model="gender" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg bg-white">
          <option v-for="g in genders" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>

      <!-- Age -->
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Age</label>
        <input v-model.number="age" type="number" min="18" max="100"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
      </div>

      <!-- Pain Current -->
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Pain (Current)</label>
        <input v-model.number="painCurrent" type="number" min="1" max="10"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
      </div>

      <!-- Pain Worst -->
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Pain (Worst)</label>
        <input v-model.number="painWorst" type="number" min="1" max="10"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
      </div>

      <!-- Pain Best -->
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Pain (Best)</label>
        <input v-model.number="painBest" type="number" min="1" max="10"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
      </div>

      <!-- Chronicity -->
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Chronicity</label>
        <select v-model="chronicityLevel" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg bg-white">
          <option v-for="c in chronicities" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <!-- Severity -->
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Severity</label>
        <select v-model="severityLevel" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg bg-white">
          <option v-for="s in severities" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <!-- Frequency -->
      <div class="col-span-2">
        <label class="text-[11px] text-ink-400 mb-1 block">Pain Frequency</label>
        <select v-model="painFrequency" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg bg-white">
          <option v-for="f in frequencies" :key="f" :value="f">{{ f }}</option>
        </select>
      </div>

      <!-- Symptom Scale -->
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Symptom Scale</label>
        <select v-model="symptomScale" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg bg-white">
          <option v-for="s in scales" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <!-- Duration -->
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Duration</label>
        <input v-model="duration" type="text" placeholder="5 year(s)"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
      </div>
    </div>

    <!-- TCM + Symptoms -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">TCM Local Pattern</label>
        <input v-model="tcmLocal" type="text"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
      </div>
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">TCM Systemic Pattern</label>
        <input v-model="tcmSystemic" type="text"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
      </div>
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Associated Symptoms (comma separated)</label>
        <input v-model="associatedSymptoms" type="text"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
      </div>
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Pain Types (comma separated)</label>
        <input v-model="painTypes" type="text"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
      </div>
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Causative Factors (comma separated)</label>
        <input v-model="causativeFactors" type="text"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
      </div>
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Aggravating Factors (comma separated)</label>
        <input v-model="aggravatingFactors" type="text"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
      </div>
      <div>
        <label class="text-[11px] text-ink-400 mb-1 block">Relieving Factors (comma separated)</label>
        <input v-model="relievingFactors" type="text"
          class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-[11px] text-ink-400 mb-1 block">Tongue</label>
          <input v-model="tongue" type="text"
            class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
        </div>
        <div>
          <label class="text-[11px] text-ink-400 mb-1 block">Pulse</label>
          <input v-model="pulse" type="text"
            class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg">
        </div>
      </div>
    </div>

    <!-- Generate Button -->
    <button @click="doGenerate()" :disabled="isGenerating"
      class="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
      <svg v-if="isGenerating" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      {{ isGenerating ? 'AI 生成中...' : `AI 生成 ${noteType}` }}
    </button>

    <!-- Error -->
    <div v-if="error" class="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
      {{ error }}
    </div>

    <!-- Result -->
    <div v-if="generatedText" class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-ink-700">AI 生成结果</span>
          <span class="text-[11px] text-ink-400">{{ elapsed.toFixed(1) }}s</span>
        </div>
        <button @click="copyFullText()"
          class="text-xs px-3 py-1 rounded border transition-colors"
          :class="copiedFull ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : 'border-ink-200 text-ink-500 hover:border-ink-400'">
          {{ copiedFull ? '已复制 ✓' : '复制全文' }}
        </button>
      </div>

      <!-- SOAP Sections -->
      <div v-for="(label, key) in { subjective: 'Subjective', objective: 'Objective', assessment: 'Assessment', plan: 'Plan' }"
        :key="key" class="bg-white rounded-xl border border-ink-200 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2 bg-ink-50 border-b border-ink-100">
          <span class="text-xs font-semibold text-ink-600">{{ label }}</span>
          <button @click="copySection(key)" class="text-[11px] text-ink-400 hover:text-ink-600">复制</button>
        </div>
        <pre class="px-4 py-3 text-xs text-ink-700 whitespace-pre-wrap font-sans leading-relaxed">{{ generatedSOAP?.[key] || '' }}</pre>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!generatedText && !isGenerating && !error" class="bg-white rounded-xl border border-ink-200 p-12 text-center">
      <svg class="w-12 h-12 mx-auto text-emerald-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"/>
      </svg>
      <p class="text-sm text-ink-400">选择参数后点击 AI 生成</p>
      <p class="text-[11px] text-ink-300 mt-1">使用 Vertex AI 微调模型生成 SOAP 笔记 (~8s)</p>
    </div>
  </div>
</template>
