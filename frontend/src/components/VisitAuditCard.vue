<script setup>
import { ref, computed } from 'vue'
import { useDiffHighlight } from '../composables/useDiffHighlight.ts'

const props = defineProps({
  visitIndex: { type: Number, required: true },
  visitText: { type: String, default: '' },
  prevVisitText: { type: String, default: '' },
  prevVisitType: { type: String, default: '' },
  nextVisitText: { type: String, default: '' },
  nextVisitType: { type: String, default: '' },
  visit: { type: Object, default: () => ({}) },
  errors: { type: Array, default: () => [] }
})

const isExpanded = ref(false)
const { diffLineWords } = useDiffHighlight(ref([]))

const visitLabel = computed(() => `Visit ${props.visitIndex + 1}`)
const visitDate = computed(() =>
  props.visit?.assessment?.date || ''
)
const bodyPart = computed(() =>
  props.visit?.subjective?.bodyPartNormalized || props.visit?.subjective?.bodyPart || ''
)
const visitType = computed(() =>
  props.visit?.subjective?.visitType === 'INITIAL EVALUATION' ? 'IE' : 'TX'
)

const icdCodes = computed(() =>
  (props.visit?.diagnosisCodes || []).map(d => d.icd10)
)
const cptCodes = computed(() =>
  (props.visit?.procedureCodes || []).map(p => p.cpt)
)

// SOAP section headers
const SECTION_HEADERS = new Set(['Subjective', 'Objective', 'Assessment', 'Plan'])

// Map checker error section.field to keywords found in SOAP text lines
const FIELD_LINE_MAP = {
  // Subjective
  'S.adlDifficultyLevel': 'difficulty',
  'S.painScale': 'pain scale',
  'S.painFrequency': 'frequency',
  'S.symptomChange': 'symptom',
  'S.chiefComplaint': 'chief complaint',
  'S.adlImpairment': 'difficulty',
  'S.painTypes': 'pain',
  'S.muscleWeaknessScale': 'weakness',
  // Objective
  'O.tenderness.scale': 'Tenderness',
  'O.tightness.scale': 'Tightness',
  'O.spasm.scale': 'Spasm',
  'O.tonguePulse': 'Tongue',
  'O.rom': 'ROM',
  'O.rom.degrees': 'degree',
  'O.rom.severity': 'degree',
  'O.rom.strength': 'strength',
  'O.rom.movement': 'ROM',
  'O.tightness/tenderness': 'Tightness',
  'O.muscles': 'muscles',
  // Assessment
  'A.tcmDiagnosis': 'TCM',
  'A.symptomChange': 'symptom',
  'A.generalCondition': 'condition',
  'A.textDescription': 'symptom',
  'A.romDescription': 'ROM',
  'A.strengthDescription': 'strength',
  'A.localPattern': 'pattern',
  'A.diagnosisCodes': 'ICD',
  // Plan
  'P.shortTermGoal': 'Short Term',
  'P.longTermGoal': 'Long Term',
  'P.electricalStimulation': 'electrical stimulation',
  'P.acupoints': 'acupoint',
  'P.procedureCodes': 'CPT',
  'P.needleSpecs.gauge': 'needle'
}

// Split text into SOAP sections for alignment
function splitSections(text) {
  const secs = { _pre: [] }
  let cur = '_pre'
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (SECTION_HEADERS.has(t)) {
      cur = t
      secs[cur] = secs[cur] || []
    } else {
      secs[cur] = secs[cur] || []
      secs[cur].push(line)
    }
  }
  return secs
}

// Build error keywords set for matching lines
const errorKeywords = computed(() => {
  const keywords = []
  for (const err of props.errors) {
    const key = `${err.location?.section || err.section}.${err.location?.field || err.field}`
    const keyword = FIELD_LINE_MAP[key]
    if (keyword) {
      keywords.push(keyword.toLowerCase())
    }
  }
  return keywords
})

function lineHasError(line) {
  if (errorKeywords.value.length === 0) return false
  const lower = line.toLowerCase()
  return errorKeywords.value.some(kw => lower.includes(kw))
}

// Determine consistency comparison target:
// - First TX → compare against IE (prevVisitText)
// - IE → compare against first TX (nextVisitText)
const consistencyTarget = computed(() => {
  if (visitType.value === 'TX' && props.prevVisitType === 'INITIAL EVALUATION' && props.prevVisitText.trim()) {
    return props.prevVisitText
  }
  if (visitType.value === 'IE' && props.nextVisitText.trim() && props.nextVisitType !== 'INITIAL EVALUATION') {
    return props.nextVisitText
  }
  return ''
})

const isConsistencyMode = computed(() => consistencyTarget.value.length > 0)

// Find the section a line belongs to by scanning lines up to lineIdx
function findSection(allLines, lineIdx) {
  let cur = '_pre'
  for (let i = 0; i <= lineIdx; i++) {
    const t = allLines[i].trim()
    if (SECTION_HEADERS.has(t)) cur = t
  }
  return cur
}

// Find best matching line in a section's lines
function findBestMatch(trimmed, sectionLines) {
  let bestMatch = ''
  let bestScore = 0
  for (const pl of sectionLines) {
    const plTrimmed = pl.trim()
    if (plTrimmed === trimmed) {
      return { match: pl, score: 1 }
    }
    const curWords = new Set(trimmed.toLowerCase().split(/\s+/))
    const prevWords = new Set(plTrimmed.toLowerCase().split(/\s+/))
    const shared = [...curWords].filter(w => prevWords.has(w)).length
    const score = shared / Math.max(curWords.size, prevWords.size, 1)
    if (score > bestScore && score > 0.3) {
      bestScore = score
      bestMatch = pl
    }
  }
  return { match: bestMatch, score: bestScore }
}

// Compute diff lines with section alignment
const diffLines = computed(() => {
  if (!props.visitText) return []

  const lines = props.visitText.split('\n')

  // IE note without consistency target or no previous for TX: no comparison
  if (!isConsistencyMode.value && (!props.prevVisitText || visitType.value === 'IE')) {
    return lines.map(line => ({
      segments: [{ text: line, hl: false, match: false }],
      hasError: lineHasError(line)
    }))
  }

  // Choose comparison target based on mode
  const compareText = isConsistencyMode.value ? consistencyTarget.value : props.prevVisitText

  // Skip normal diff when prev is IE but no consistency mode (shouldn't happen with current logic, but safe guard)
  if (!compareText) {
    return lines.map(line => ({
      segments: [{ text: line, hl: false, match: false }],
      hasError: lineHasError(line)
    }))
  }

  const compareSecs = splitSections(compareText)

  return lines.map((line, lineIdx) => {
    const trimmed = line.trim()

    // Section headers and blank lines: no highlighting
    if (SECTION_HEADERS.has(trimmed) || trimmed === '') {
      return { segments: [{ text: line, hl: false, match: false }], hasError: false }
    }

    const curSection = findSection(lines, lineIdx)
    const targetSecLines = compareSecs[curSection] || []
    const { match: bestMatch, score: bestScore } = findBestMatch(trimmed, targetSecLines)

    if (isConsistencyMode.value) {
      // Consistency mode: highlight MATCHING parts (red) with IE/TX counterpart
      if (bestScore >= 1) {
        // Exact match: whole line is consistent
        return {
          segments: [{ text: line, hl: false, match: true }],
          hasError: lineHasError(line)
        }
      }
      if (bestMatch) {
        // Partial match: run diff and invert — matching words get {match: true}
        const diffSegs = diffLineWords(line, bestMatch)
        const segs = diffSegs.map(seg => ({
          text: seg.text,
          hl: false,
          match: !seg.hl && seg.text.trim().length > 0
        }))
        return { segments: segs, hasError: lineHasError(line) }
      }
      // No match: line is unique to this visit type (expected)
      return {
        segments: [{ text: line, hl: false, match: false }],
        hasError: lineHasError(line)
      }
    }

    // Normal diff mode (TX vs TX): highlight CHANGED parts (yellow)
    if (bestScore >= 1) {
      return {
        segments: [{ text: line, hl: false, match: false }],
        hasError: lineHasError(line)
      }
    }
    if (bestMatch) {
      const segs = diffLineWords(line, bestMatch).map(s => ({ ...s, match: false }))
      return { segments: segs, hasError: lineHasError(line) }
    }
    if (trimmed) {
      return {
        segments: [{ text: line, hl: true, match: false }],
        hasError: lineHasError(line)
      }
    }
    return {
      segments: [{ text: line, hl: false, match: false }],
      hasError: lineHasError(line)
    }
  })
})

const errorCount = computed(() => props.errors.length)
</script>

<template>
  <div class="border border-ink-200 rounded-lg overflow-hidden bg-white">
    <!-- Header -->
    <button
      @click="isExpanded = !isExpanded"
      class="w-full px-4 py-3 flex items-center justify-between bg-paper-100/50 hover:bg-paper-100 transition-colors"
    >
      <div class="flex items-center gap-3 min-w-0">
        <!-- Expand Icon -->
        <svg
          class="w-5 h-5 text-ink-500 transition-transform duration-200 shrink-0"
          :class="isExpanded ? 'rotate-90' : ''"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>

        <!-- Visit Label + Date -->
        <div class="min-w-0">
          <p class="text-sm font-semibold text-ink-800">
            {{ visitLabel }}
            <span class="ml-1.5 text-xs font-normal text-ink-500">{{ visitDate }}</span>
          </p>
          <p v-if="bodyPart" class="text-xs text-ink-500 mt-0.5 truncate">{{ bodyPart }}</p>
        </div>

        <!-- Visit Type Badge -->
        <span
          :class="[
            'px-2 py-0.5 text-xs font-medium rounded shrink-0',
            visitType === 'IE'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-paper-200 text-ink-600'
          ]"
        >{{ visitType }}</span>

        <!-- Consistency Badge -->
        <span
          v-if="isConsistencyMode"
          class="px-2 py-0.5 text-[11px] font-medium rounded shrink-0 bg-red-50 text-red-600 border border-red-200"
        >IE-TX</span>

        <!-- Error Count Badge -->
        <span
          v-if="errorCount > 0"
          class="px-2 py-0.5 text-xs font-medium rounded bg-status-fail/10 text-status-fail shrink-0"
        >{{ errorCount }} errors</span>
      </div>

      <!-- Right: ICD + CPT Badges -->
      <div class="flex flex-wrap items-center gap-1 shrink-0 ml-3">
        <span
          v-for="icd in icdCodes"
          :key="icd"
          class="px-1.5 py-0.5 text-[11px] font-mono bg-amber-50 text-amber-700 border border-amber-200 rounded"
        >{{ icd }}</span>
        <span
          v-for="cpt in cptCodes"
          :key="cpt"
          class="px-1.5 py-0.5 text-[11px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 rounded"
        >{{ cpt }}</span>
      </div>
    </button>

    <!-- Expanded Content: SOAP Text -->
    <div v-show="isExpanded" class="p-4 border-t border-ink-100">
      <!-- Legend -->
      <div v-if="isConsistencyMode" class="mb-3 flex items-center gap-4 text-[11px] text-ink-500">
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-3 h-2.5 bg-red-200/60 rounded-sm border border-red-300/50"></span>
          IE-TX 一致
        </span>
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-3 h-2.5 bg-paper-50 rounded-sm border border-ink-200"></span>
          动态差异（预期）
        </span>
        <span v-if="errorCount > 0" class="flex items-center gap-1.5">
          <span class="inline-block w-3 h-2.5 border-b-2 border-red-500 rounded-sm" style="border-bottom-style: wavy;"></span>
          错误
        </span>
      </div>

      <div class="p-3 bg-paper-50 border border-ink-100 rounded-lg max-h-[500px] overflow-y-auto">
        <div class="text-sm text-ink-800 leading-relaxed font-mono whitespace-pre-wrap">
          <div v-for="(line, i) in diffLines" :key="i">
            <span
              :class="{ 'decoration-wavy decoration-red-500 underline underline-offset-4': line.hasError }"
            ><template v-for="(seg, j) in line.segments" :key="j"
              ><mark v-if="seg.hl" class="bg-yellow-200/80">{{ seg.text }}</mark
              ><mark v-else-if="seg.match" class="bg-red-200/60 text-red-900">{{ seg.text }}</mark
              ><template v-else>{{ seg.text }}</template
            ></template></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
