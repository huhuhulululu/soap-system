<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  visitIndex: {
    type: Number,
    required: true
  },
  visitDate: {
    type: String,
    default: ''
  },
  corrections: {
    type: Array,
    required: true
  }
})

const isExpanded = ref(false)
const copied = ref(false)

const visitLabel = computed(() => `Visit ${props.visitIndex + 1}`)

// Get all field fixes from all corrections for this visit
const allFieldFixes = computed(() => {
  return props.corrections.flatMap(c => c.fieldFixes || [])
})

// Get the full corrected SOAP text (should be the same across all corrections for this visit)
const correctedSOAPText = computed(() => {
  return props.corrections[0]?.correctedFullText || ''
})

// Get all errors
const allErrors = computed(() => {
  return props.corrections.flatMap(c => c.errors || [])
})

// Highest severity
const highestSeverity = computed(() => {
  const severities = allErrors.value.map(e => e.severity)
  if (severities.includes('CRITICAL')) return 'CRITICAL'
  if (severities.includes('HIGH')) return 'HIGH'
  if (severities.includes('MEDIUM')) return 'MEDIUM'
  if (severities.includes('LOW')) return 'LOW'
  return 'MEDIUM'
})

const copyCorrectedSOAP = async () => {
  try {
    await navigator.clipboard.writeText(correctedSOAPText.value)
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

// Build fix summary
const fixSummary = computed(() => {
  if (allFieldFixes.value.length === 0) return '(无修正)'
  return allFieldFixes.value.map(f => `${f.field}: ${f.original} → ${f.corrected}\n  原因: ${f.reason}`).join('\n\n')
})
</script>

<template>
  <div class="border border-ink-200 rounded-lg overflow-hidden bg-white">
    <!-- Header (Collapsible Trigger) -->
    <button
      @click="isExpanded = !isExpanded"
      class="w-full px-4 py-3 flex items-center justify-between bg-paper-100/50 hover:bg-paper-100 transition-colors"
    >
      <div class="flex items-center gap-3">
        <!-- Expand Icon -->
        <svg
          class="w-5 h-5 text-ink-500 transition-transform duration-200"
          :class="isExpanded ? 'rotate-90' : ''"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>

        <!-- Visit Label -->
        <div>
          <p class="text-sm font-semibold text-ink-800">{{ visitLabel }}</p>
          <p class="text-xs text-ink-500 mt-0.5">
            {{ visitDate || 'N/A' }} · {{ allErrors.length }} 错误
          </p>
        </div>

        <!-- Severity Badge -->
        <span
          :class="['px-2 py-0.5 text-xs font-medium rounded', getSeverityClass(highestSeverity)]"
        >
          {{ highestSeverity }}
        </span>
      </div>

      <!-- Copy Button (stops propagation) -->
      <button
        @click.stop="copyCorrectedSOAP"
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
          <span>{{ copied ? '已复制' : '复制完整 SOAP' }}</span>
        </div>
      </button>
    </button>

    <!-- Expanded Content -->
    <div v-show="isExpanded" class="divide-y divide-ink-100">
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
      </div>

      <!-- Corrected Full SOAP Text -->
      <div class="p-4">
        <div class="flex items-center gap-2 mb-2">
          <svg class="w-4 h-4 text-status-pass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-xs font-medium text-ink-600">纠正后完整 SOAP 文本</span>
        </div>
        <div class="p-3 bg-status-pass/5 border border-status-pass/20 rounded-lg max-h-96 overflow-y-auto">
          <p class="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap font-mono">{{ correctedSOAPText }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.severity-critical {
  @apply bg-status-fail text-white;
}

.severity-high {
  @apply bg-orange-500 text-white;
}

.severity-medium {
  @apply bg-status-warning text-ink-800;
}

.severity-low {
  @apply bg-blue-100 text-blue-800;
}
</style>
