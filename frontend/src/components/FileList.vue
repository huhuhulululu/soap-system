<script setup>
defineProps({
  files: {
    type: Array,
    required: true
  },
  selectedId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['select', 'remove', 'preview'])

function getStatusIcon(status) {
  switch (status) {
    case 'pending': return 'clock'
    case 'processing': return 'spinner'
    case 'done': return 'check'
    case 'error': return 'x'
    default: return 'clock'
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'pending': return 'text-ink-400'
    case 'processing': return 'text-status-info'
    case 'done': return 'text-status-pass'
    case 'error': return 'text-status-fail'
    default: return 'text-ink-400'
  }
}

function getGradeClass(grade) {
  switch (grade) {
    case 'PASS': return 'grade-pass'
    case 'WARNING': return 'grade-warning'
    case 'FAIL': return 'grade-fail'
    default: return ''
  }
}
</script>

<template>
  <div class="card divide-y divide-ink-100">
    <div class="px-4 py-3 bg-paper-100/50 rounded-t-xl">
      <h3 class="font-medium text-ink-700 text-sm">
        文件列表
        <span class="text-ink-400 font-normal">({{ files.length }})</span>
      </h3>
    </div>

    <div class="max-h-[400px] overflow-y-auto">
      <div
        v-for="file in files"
        :key="file.id"
        @click="file.status === 'done' && emit('select', file)"
        :class="[
          'px-4 py-3 flex items-center gap-3 transition-all',
          file.status === 'done' ? 'cursor-pointer hover:bg-paper-100' : '',
          selectedId === file.id ? 'bg-ink-50 border-l-2 border-ink-600' : ''
        ]"
      >
        <!-- Status Icon -->
        <div :class="['flex-shrink-0', getStatusColor(file.status)]">
          <!-- Pending -->
          <svg v-if="file.status === 'pending'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <!-- Processing -->
          <svg v-else-if="file.status === 'processing'" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <!-- Done -->
          <svg v-else-if="file.status === 'done'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <!-- Error -->
          <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <!-- File Info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-ink-800 truncate">
            {{ file.name }}
          </p>
          <p v-if="file.error" class="text-xs text-status-fail truncate">
            {{ file.error }}
          </p>
          <p v-else-if="file.status === 'processing'" class="text-xs text-ink-400">
            验证中...
          </p>
        </div>

        <!-- Preview Button (if done) -->
        <button
          v-if="file.status === 'done' && file.report"
          @click.stop="emit('preview', file)"
          class="flex-shrink-0 p-1 text-ink-400 hover:text-ink-700 transition-colors"
          title="预览原文"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>

        <!-- Grade Badge (if done) -->
        <div v-if="file.status === 'done' && file.report" class="flex items-center gap-2">
          <span :class="[
            'px-2 py-0.5 text-xs font-medium rounded border',
            getGradeClass(file.report.summary.scoring.grade)
          ]">
            {{ file.report.summary.scoring.totalScore }}
          </span>
        </div>

        <!-- Remove Button -->
        <button
          @click.stop="emit('remove', file.id)"
          class="flex-shrink-0 p-1 text-ink-300 hover:text-status-fail transition-colors"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="files.length === 0" class="px-4 py-8 text-center text-ink-400 text-sm">
      暂无文件
    </div>
  </div>
</template>
