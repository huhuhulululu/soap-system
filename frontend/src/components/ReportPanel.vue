<script setup>
import { computed } from 'vue'
import { exportReportAsCSV } from '../services/exporter'

const props = defineProps({
  file: {
    type: Object,
    default: null
  }
})

const report = computed(() => props.file?.report)

function getGradeClass(grade) {
  switch (grade) {
    case 'PASS': return 'grade-pass'
    case 'WARNING': return 'grade-warning'
    case 'FAIL': return 'grade-fail'
    default: return ''
  }
}

function getGradeText(grade) {
  switch (grade) {
    case 'PASS': return '通过'
    case 'WARNING': return '异常'
    case 'FAIL': return '不通过'
    default: return '-'
  }
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

function getTrendIcon(direction) {
  switch (direction) {
    case 'improving': return '↑'
    case 'worsening': return '↓'
    case 'stable': return '→'
    default: return '~'
  }
}
</script>

<template>
  <!-- Empty State -->
  <div v-if="!file" class="card h-full min-h-[500px] flex items-center justify-center">
    <div class="text-center text-ink-400">
      <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p class="text-sm">选择一个已验证的文件查看报告</p>
    </div>
  </div>

  <!-- Report Content -->
  <div v-else-if="report" class="card overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-5 bg-paper-100/50 border-b border-ink-100">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="font-display text-xl font-semibold text-ink-800">
            {{ report.patient.name }}
          </h2>
          <p class="text-sm text-ink-500 mt-1">
            患者ID: {{ report.patient.patientId }} · DOB: {{ report.patient.dob }}
          </p>
        </div>

        <!-- Score Badge -->
        <div class="text-center space-y-2">
          <div :class="[
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg border',
            getGradeClass(report.summary.scoring.grade)
          ]">
            <span class="font-display text-2xl font-bold">
              {{ report.summary.scoring.totalScore }}
            </span>
            <span class="text-sm font-medium">
              {{ getGradeText(report.summary.scoring.grade) }}
            </span>
          </div>
          <button @click="exportReportAsCSV(report)" class="block text-xs text-ink-400 hover:text-ink-600 transition-colors">
            导出 CSV
          </button>
        </div>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="px-6 py-4 grid grid-cols-4 gap-4 border-b border-ink-100">
      <div>
        <p class="text-xs text-ink-500">总就诊次数</p>
        <p class="text-lg font-semibold text-ink-800">{{ report.summary.totalVisits }}</p>
      </div>
      <div>
        <p class="text-xs text-ink-500">日期范围</p>
        <p class="text-sm font-medium text-ink-700">
          {{ report.summary.visitDateRange.first }} - {{ report.summary.visitDateRange.last }}
        </p>
      </div>
      <div>
        <p class="text-xs text-ink-500">总错误数</p>
        <p class="text-lg font-semibold" :class="report.summary.errorCount.total > 0 ? 'text-status-fail' : 'text-status-pass'">
          {{ report.summary.errorCount.total }}
        </p>
      </div>
      <div>
        <p class="text-xs text-ink-500">Pain趋势</p>
        <p class="text-sm font-medium text-ink-700 flex items-center gap-1">
          <span>{{ getTrendIcon(report.timeline.trends.painScale.direction) }}</span>
          <span class="capitalize">{{ report.timeline.trends.painScale.direction }}</span>
        </p>
      </div>
    </div>

    <!-- Score Breakdown -->
    <div class="px-6 py-4 border-b border-ink-100">
      <h3 class="text-sm font-medium text-ink-700 mb-3">评分明细</h3>
      <div class="space-y-2">
        <div class="flex items-center gap-3">
          <span class="text-xs text-ink-500 w-24">SOAP一致性</span>
          <div class="flex-1 h-2 bg-paper-200 rounded-full overflow-hidden">
            <div
              class="h-full bg-ink-600 transition-all"
              :style="{ width: `${report.summary.scoring.breakdown.soapConsistency}%` }"
            ></div>
          </div>
          <span class="text-xs font-mono text-ink-600 w-8">{{ report.summary.scoring.breakdown.soapConsistency }}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-ink-500 w-24">时间线逻辑</span>
          <div class="flex-1 h-2 bg-paper-200 rounded-full overflow-hidden">
            <div
              class="h-full bg-ink-600 transition-all"
              :style="{ width: `${report.summary.scoring.breakdown.timelineLogic}%` }"
            ></div>
          </div>
          <span class="text-xs font-mono text-ink-600 w-8">{{ report.summary.scoring.breakdown.timelineLogic }}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-ink-500 w-24">规则合规</span>
          <div class="flex-1 h-2 bg-paper-200 rounded-full overflow-hidden">
            <div
              class="h-full bg-ink-600 transition-all"
              :style="{ width: `${report.summary.scoring.breakdown.ruleCompliance}%` }"
            ></div>
          </div>
          <span class="text-xs font-mono text-ink-600 w-8">{{ report.summary.scoring.breakdown.ruleCompliance }}</span>
        </div>
      </div>
    </div>

    <!-- Timeline -->
    <div class="px-6 py-4 border-b border-ink-100">
      <h3 class="text-sm font-medium text-ink-700 mb-3">就诊时间线</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-ink-500 border-b border-ink-100">
              <th class="pb-2 font-medium">#</th>
              <th class="pb-2 font-medium">日期</th>
              <th class="pb-2 font-medium">类型</th>
              <th class="pb-2 font-medium">Pain</th>
              <th class="pb-2 font-medium">变化</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="visit in report.timeline.visits"
              :key="visit.index"
              class="border-b border-ink-50 last:border-0"
            >
              <td class="py-2 text-ink-400 font-mono">{{ visit.index + 1 }}</td>
              <td class="py-2 text-ink-700">{{ visit.date }}</td>
              <td class="py-2">
                <span :class="[
                  'px-2 py-0.5 text-xs rounded',
                  visit.type === 'INITIAL EVALUATION' ? 'bg-status-info/10 text-status-info' : 'bg-paper-200 text-ink-600'
                ]">
                  {{ visit.type === 'INITIAL EVALUATION' ? 'IE' : 'TX' }}
                </span>
              </td>
              <td class="py-2 font-mono text-ink-700">{{ visit.painScale }}/10</td>
              <td class="py-2">
                <span v-if="visit.symptomChange === '-'" class="text-ink-400">-</span>
                <span v-else-if="visit.symptomChange === 'improvement'" class="text-status-pass">✓ 改善</span>
                <span v-else-if="visit.symptomChange === 'no change'" class="text-status-warning">→ 无变化</span>
                <span v-else class="text-status-fail">↓ 恶化</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Errors -->
    <div class="px-6 py-4">
      <h3 class="text-sm font-medium text-ink-700 mb-3">
        错误详情
        <span v-if="report.allErrors.length > 0" class="text-ink-400 font-normal">
          ({{ report.allErrors.length }})
        </span>
      </h3>

      <!-- No Errors -->
      <div v-if="report.allErrors.length === 0" class="py-8 text-center">
        <div class="w-12 h-12 mx-auto mb-3 bg-status-pass/10 rounded-full flex items-center justify-center">
          <svg class="w-6 h-6 text-status-pass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p class="text-sm text-ink-500">未检测到错误</p>
      </div>

      <!-- Error List -->
      <div v-else class="space-y-3">
        <div
          v-for="error in report.allErrors"
          :key="error.id"
          class="p-4 bg-paper-100 rounded-lg border border-ink-100"
        >
          <div class="flex items-start gap-3">
            <span :class="[
              'flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded',
              getSeverityClass(error.severity)
            ]">
              {{ error.severity }}
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-ink-800">{{ error.ruleName }}</p>
              <p class="text-sm text-ink-600 mt-1">{{ error.message }}</p>
              <p class="text-xs text-ink-400 mt-2 font-mono">
                Visit {{ error.location.visitIndex + 1 }} · {{ error.location.section }}.{{ error.location.field }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Processing State -->
  <div v-else-if="file.status === 'processing'" class="card h-full min-h-[500px] flex items-center justify-center">
    <div class="text-center">
      <svg class="w-12 h-12 mx-auto mb-4 text-ink-400 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-sm text-ink-500">正在验证 {{ file.name }}...</p>
    </div>
  </div>
</template>
