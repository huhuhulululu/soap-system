<script setup>
defineProps({
  stats: {
    type: Object,
    required: true
  }
})

function getGradeColor(grade) {
  switch (grade) {
    case 'PASS': return 'bg-status-pass'
    case 'WARNING': return 'bg-status-warning'
    case 'FAIL': return 'bg-status-fail'
    default: return 'bg-ink-300'
  }
}
</script>

<template>
  <div class="card p-5">
    <h3 class="font-medium text-ink-700 text-sm mb-4">批量统计</h3>

    <!-- Main Stats Grid -->
    <div class="grid grid-cols-2 gap-4 mb-5">
      <!-- Total Files -->
      <div class="bg-paper-100 rounded-lg p-3">
        <p class="text-2xl font-display font-semibold text-ink-800">
          {{ stats.total }}
        </p>
        <p class="text-xs text-ink-500">已验证文件</p>
      </div>

      <!-- Avg Score -->
      <div class="bg-paper-100 rounded-lg p-3">
        <p class="text-2xl font-display font-semibold text-ink-800">
          {{ stats.avgScore }}
        </p>
        <p class="text-xs text-ink-500">平均分数</p>
      </div>
    </div>

    <!-- Grade Distribution -->
    <div class="mb-4">
      <p class="text-xs text-ink-500 mb-2">等级分布</p>
      <div class="flex gap-1 h-3 rounded-full overflow-hidden bg-paper-200">
        <div
          v-if="stats.grades.PASS > 0"
          :style="{ width: `${(stats.grades.PASS / stats.total) * 100}%` }"
          class="bg-status-pass transition-all"
        ></div>
        <div
          v-if="stats.grades.WARNING > 0"
          :style="{ width: `${(stats.grades.WARNING / stats.total) * 100}%` }"
          class="bg-status-warning transition-all"
        ></div>
        <div
          v-if="stats.grades.FAIL > 0"
          :style="{ width: `${(stats.grades.FAIL / stats.total) * 100}%` }"
          class="bg-status-fail transition-all"
        ></div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex items-center justify-between text-xs">
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-status-pass"></span>
        <span class="text-ink-600">通过</span>
        <span class="text-ink-400 font-mono">{{ stats.grades.PASS }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-status-warning"></span>
        <span class="text-ink-600">异常</span>
        <span class="text-ink-400 font-mono">{{ stats.grades.WARNING }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-status-fail"></span>
        <span class="text-ink-600">不通过</span>
        <span class="text-ink-400 font-mono">{{ stats.grades.FAIL }}</span>
      </div>
    </div>

    <!-- Total Errors -->
    <div class="mt-4 pt-4 border-t border-ink-100">
      <div class="flex items-center justify-between">
        <span class="text-xs text-ink-500">总错误数</span>
        <span class="text-sm font-mono font-medium text-ink-700">{{ stats.totalErrors }}</span>
      </div>
    </div>
  </div>
</template>
