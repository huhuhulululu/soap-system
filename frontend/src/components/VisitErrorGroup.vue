<script setup>
import { computed, ref, watchEffect } from 'vue'

const props = defineProps({
  errors: {
    type: Array,
    required: true
  },
  timeline: {
    type: Array,
    required: true
  }
})

const expandedVisits = ref(new Set())
const hasInitialized = ref(false)

// Group errors by visit index
const errorsByVisit = computed(() => {
  const grouped = new Map()

  props.errors.forEach(error => {
    // Support both normalized format (error.location.visitIndex) and legacy format (error.visitIndex)
    const visitIndex = error.location?.visitIndex ?? error.visitIndex
    if (!grouped.has(visitIndex)) {
      grouped.set(visitIndex, [])
    }
    grouped.get(visitIndex).push(error)
  })

  return grouped
})

// Get visit info with error summary
const visitsWithErrors = computed(() => {
  const visits = []

  errorsByVisit.value.forEach((errors, visitIndex) => {
    const timelineEntry = props.timeline[visitIndex]
    const hasCritical = errors.some(e => e.severity === 'CRITICAL')

    visits.push({
      index: visitIndex,
      date: timelineEntry?.date || 'Unknown',
      type: timelineEntry?.type || 'Unknown',
      errors,
      errorCount: errors.length,
      hasCritical,
      criticalCount: errors.filter(e => e.severity === 'CRITICAL').length,
      highCount: errors.filter(e => e.severity === 'HIGH').length,
      mediumCount: errors.filter(e => e.severity === 'MEDIUM').length
    })
  })

  // Sort by visit index
  return visits.sort((a, b) => a.index - b.index)
})

// Auto-expand visits with CRITICAL errors only on initial load
watchEffect(() => {
  if (!hasInitialized.value && visitsWithErrors.value.length > 0) {
    const criticalVisits = visitsWithErrors.value
      .filter(v => v.hasCritical)
      .map(v => v.index)

    expandedVisits.value = new Set(criticalVisits)
    hasInitialized.value = true
  }
})

const toggleVisit = (visitIndex) => {
  const currentSet = new Set(expandedVisits.value)
  if (currentSet.has(visitIndex)) {
    currentSet.delete(visitIndex)
  } else {
    currentSet.add(visitIndex)
  }
  expandedVisits.value = currentSet
}

const isExpanded = (visitIndex) => {
  return expandedVisits.value.has(visitIndex)
}

function getSeverityClass(severity) {
  switch (severity) {
    case 'CRITICAL': return 'severity-critical'
    case 'HIGH': return 'severity-high'
    case 'MEDIUM': return 'severity-medium'
    case 'LOW': return 'severity-low'
    default: return ''
  }
}

function getVisitTypeDisplay(type) {
  return type === 'INITIAL EVALUATION' ? 'IE' : 'TX'
}

function getVisitTypeClass(type) {
  return type === 'INITIAL EVALUATION'
    ? 'bg-status-info/10 text-status-info'
    : 'bg-paper-200 text-ink-600'
}
</script>

<template>
  <div class="space-y-3">
    <!-- No Errors State -->
    <div v-if="visitsWithErrors.length === 0" class="py-8 text-center">
      <div class="w-12 h-12 mx-auto mb-3 bg-status-pass/10 rounded-full flex items-center justify-center">
        <svg class="w-6 h-6 text-status-pass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p class="text-sm text-ink-500">未检测到错误</p>
    </div>

    <!-- Visit Groups -->
    <div
      v-for="visit in visitsWithErrors"
      :key="visit.index"
      class="border rounded-lg overflow-hidden transition-all duration-200"
      :class="visit.hasCritical ? 'border-status-fail/30 bg-status-fail/5' : 'border-ink-100 bg-white'"
    >
      <!-- Visit Header (Clickable) -->
      <div
        class="px-4 py-3 cursor-pointer hover:bg-paper-50/50 transition-colors"
        @click="toggleVisit(visit.index)"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <!-- Expand/Collapse Icon -->
            <svg
              class="w-5 h-5 text-ink-400 transition-transform duration-200"
              :class="isExpanded(visit.index) ? 'rotate-90' : ''"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>

            <!-- Visit Info -->
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-ink-800">Visit {{ visit.index + 1 }}</span>
                <span class="text-sm text-ink-500">{{ visit.date }}</span>
                <span
                  class="px-2 py-0.5 text-xs rounded"
                  :class="getVisitTypeClass(visit.type)"
                >
                  {{ getVisitTypeDisplay(visit.type) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Error Count Summary -->
          <div class="flex items-center gap-2 text-xs">
            <span v-if="visit.criticalCount > 0" class="px-2 py-1 rounded severity-critical font-medium">
              {{ visit.criticalCount }} CRITICAL
            </span>
            <span v-if="visit.highCount > 0" class="px-2 py-1 rounded severity-high font-medium">
              {{ visit.highCount }} HIGH
            </span>
            <span v-if="visit.mediumCount > 0" class="px-2 py-1 rounded severity-medium font-medium">
              {{ visit.mediumCount }} MEDIUM
            </span>
            <span class="text-ink-400 font-medium ml-1">
              共 {{ visit.errorCount }} 个错误
            </span>
          </div>
        </div>
      </div>

      <!-- Error List (Expandable) -->
      <div
        v-show="isExpanded(visit.index)"
        class="px-4 pb-4 space-y-2 border-t border-ink-100/50"
      >
        <div
          v-for="error in visit.errors"
          :key="error.id"
          class="p-3 bg-paper-50 rounded-lg border border-ink-100 mt-2"
        >
          <div class="flex items-start gap-3">
            <!-- Severity Badge -->
            <span
              :class="['flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded', getSeverityClass(error.severity)]"
            >
              {{ error.severity }}
            </span>

            <!-- Error Details -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-ink-800">{{ error.ruleName }}</p>
              <p class="text-sm text-ink-600 mt-1">{{ error.message }}</p>
              <p class="text-xs text-ink-400 mt-2 font-mono">
                {{ error.location?.section || 'unknown' }}.{{ error.location?.field || 'unknown' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
