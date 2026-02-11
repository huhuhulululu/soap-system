<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  correction: {
    type: Object,
    required: true
  }
})

const copied = ref(false)

// Get the first error from the correction's errors array
const primaryError = computed(() => props.correction.errors?.[0] || {})

// Determine which SOAP section this is
const soapSection = computed(() => {
  const section = props.correction.section || 'S'
  const sectionNames = { S: 'Subjective', O: 'Objective', A: 'Assessment', P: 'Plan' }
  return sectionNames[section] || section
})

// Get severity from the first error
const severity = computed(() => primaryError.value.severity || 'MEDIUM')

// Get rule name from the first error
const ruleName = computed(() => {
  const err = primaryError.value
  return err.ruleName ? `${err.ruleId} ${err.ruleName}` : 'Correction'
})

// Get field name from first fieldFix or error
const fieldName = computed(() => {
  const fix = props.correction.fieldFixes?.[0]
  return fix?.field || primaryError.value.field || ''
})

// Copy full corrected text to clipboard
const copyCorrection = async () => {
  try {
    const text = props.correction.correctedFullText || ''
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    throw new Error('Failed to copy: ' + err.message)
  }
}

function getSeverityClass(sev) {
  switch (sev) {
    case 'CRITICAL': return 'severity-critical'
    case 'HIGH': return 'severity-high'
    case 'MEDIUM': return 'severity-medium'
    case 'LOW': return 'severity-low'
    default: return ''
  }
}

// Build original text summary from fieldFixes
const originalSummary = computed(() => {
  const fixes = props.correction.fieldFixes || []
  if (fixes.length === 0) return '(无原始数据)'
  return fixes.map(f => `${f.field}: ${f.original}`).join('\n')
})

// Build fix summary from fieldFixes
const fixSummary = computed(() => {
  const fixes = props.correction.fieldFixes || []
  if (fixes.length === 0) return '(无修正)'
  return fixes.map(f => `${f.field}: ${f.original} → ${f.corrected}\n  原因: ${f.reason}`).join('\n\n')
})

// Full corrected text
const correctedText = computed(() => {
  return props.correction.correctedFullText || ''
})

// Error message
const errorMessage = computed(() => {
  return primaryError.value.message || ''
})
</script>

<template>
  <div class="card overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 bg-paper-100/50 border-b border-ink-100 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span
          :class="['px-2 py-0.5 text-xs font-medium rounded', getSeverityClass(severity)]"
        >
          {{ severity }}
        </span>
        <div>
          <p class="text-sm font-medium text-ink-800">{{ ruleName }}</p>
          <p class="text-xs text-ink-500 mt-0.5">
            {{ soapSection }} · {{ fieldName }}
          </p>
        </div>
      </div>

      <!-- Copy Button -->
      <button
        @click="copyCorrection"
        class="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200"
        :class="copied
          ? 'bg-status-pass/10 text-status-pass'
          : 'bg-paper-200 text-ink-700 hover:bg-paper-300'"
      >
        <div class="flex items-center gap-1.5">
          <svg
            v-if="copied"
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <svg
            v-else
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>{{ copied ? '已复制' : '复制' }}</span>
        </div>
      </button>
    </div>

    <!-- Comparison View -->
    <div class="divide-y divide-ink-100">
      <!-- Fix Summary -->
      <div class="p-4">
        <div class="flex items-center gap-2 mb-2">
          <svg class="w-4 h-4 text-status-fail" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="text-xs font-medium text-ink-600">修正项</span>
        </div>
        <div class="p-3 bg-status-fail/5 border border-status-fail/20 rounded-lg">
          <p class="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap font-mono">{{ fixSummary }}</p>
        </div>
        <p v-if="errorMessage" class="text-xs text-status-fail mt-2">{{ errorMessage }}</p>
      </div>

      <!-- Corrected Full Text -->
      <div class="p-4">
        <div class="flex items-center gap-2 mb-2">
          <svg class="w-4 h-4 text-status-pass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-xs font-medium text-ink-600">纠正后完整文本</span>
        </div>
        <div class="p-3 bg-status-pass/5 border border-status-pass/20 rounded-lg max-h-64 overflow-y-auto">
          <p class="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap font-mono">{{ correctedText }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
