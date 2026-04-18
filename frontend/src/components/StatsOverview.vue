<script setup>
defineProps({
  stats: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <div class="card px-3 py-2">
    <div class="flex items-center justify-between text-xs mb-1.5">
      <span class="font-medium text-ink-800">
        {{ stats.total }} 文件
        <span class="text-ink-400 font-normal">· 平均 {{ stats.avgScore }}</span>
      </span>
      <span class="text-ink-500">
        <span class="font-medium" :class="stats.totalErrors > 0 ? 'text-status-fail' : 'text-status-pass'">{{ stats.totalErrors }}</span>
        错误
      </span>
    </div>
    <div class="flex h-1.5 rounded-full overflow-hidden bg-paper-200">
      <div
        v-if="stats.grades.PASS > 0"
        class="bg-status-pass transition-all"
        :style="{ width: `${(stats.grades.PASS / stats.total) * 100}%` }"
      ></div>
      <div
        v-if="stats.grades.WARNING > 0"
        class="bg-status-warning transition-all"
        :style="{ width: `${(stats.grades.WARNING / stats.total) * 100}%` }"
      ></div>
      <div
        v-if="stats.grades.FAIL > 0"
        class="bg-status-fail transition-all"
        :style="{ width: `${(stats.grades.FAIL / stats.total) * 100}%` }"
      ></div>
    </div>
    <div class="flex gap-3 mt-1 text-xs">
      <span class="text-status-pass">● {{ stats.grades.PASS }} 通过</span>
      <span class="text-status-warning">● {{ stats.grades.WARNING }} 异常</span>
      <span class="text-status-fail">● {{ stats.grades.FAIL }} 不通过</span>
    </div>
  </div>
</template>
