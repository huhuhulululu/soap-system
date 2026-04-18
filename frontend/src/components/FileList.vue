<script setup>
import FileUploader from './FileUploader.vue'

defineProps({
  files: { type: Array, required: true },
  selectedId: { type: String, default: null },
  pendingCount: { type: Number, default: 0 },
  isProcessing: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'remove', 'preview', 'validate', 'clear-all', 'files-added'])

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
  <div class="card overflow-hidden">
    <!-- Header -->
    <div class="px-3 py-1.5 bg-paper-100/50 border-b border-ink-100 flex items-center justify-between gap-2">
      <h3 class="text-xs font-medium text-ink-600">
        文件 <span class="text-ink-400 font-normal">({{ files.length }}{{ pendingCount > 0 ? ` · ${pendingCount} 待验证` : '' }})</span>
      </h3>
      <div class="flex items-center gap-2">
        <button
          v-if="pendingCount > 0 && !isProcessing"
          @click="emit('validate')"
          class="px-2 py-0.5 text-xs font-medium text-white rounded bg-ink-700 hover:bg-ink-600 transition-colors"
        >▶ 验证</button>
        <button
          v-if="isProcessing"
          disabled
          class="px-2 py-0.5 text-xs font-medium text-ink-400 rounded bg-paper-200 flex items-center gap-1"
        >
          <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          验证中
        </button>
        <button
          v-if="files.length > 0"
          @click="emit('clear-all')"
          class="text-xs text-ink-400 hover:text-status-fail transition-colors"
        >清空全部 ×</button>
      </div>
    </div>

    <!-- Rows -->
    <div v-if="files.length > 0" class="max-h-[50vh] overflow-y-auto divide-y divide-ink-100">
      <div
        v-for="file in files"
        :key="file.id"
        @click="file.status === 'done' && emit('select', file)"
        :class="[
          'file-row px-3 py-2 flex items-center gap-2.5 transition-colors',
          file.status === 'done' ? 'cursor-pointer hover:bg-paper-50' : '',
          selectedId === file.id ? 'is-selected' : ''
        ]"
      >
        <!-- Status Icon -->
        <div :class="['flex-shrink-0', getStatusColor(file.status)]">
          <svg v-if="file.status === 'pending'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else-if="file.status === 'processing'" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <svg v-else-if="file.status === 'done'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <!-- File Info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm text-ink-800 truncate">{{ file.name }}</p>
          <p v-if="file.error" class="text-xs text-status-fail truncate">{{ file.error }}</p>
          <p v-else-if="file.status === 'processing'" class="text-xs text-ink-400">验证中...</p>
        </div>

        <!-- Grade Badge (if done) -->
        <span
          v-if="file.status === 'done' && file.report"
          :class="[
            'px-1.5 py-0.5 text-xs font-medium rounded border shrink-0',
            getGradeClass(file.report.summary.scoring.grade)
          ]"
        >{{ file.report.summary.scoring.totalScore }}</span>

        <!-- Row Actions (hover-reveal on hover-capable devices; always shown on touch) -->
        <div class="row-actions flex items-center gap-0.5 shrink-0">
          <button
            v-if="file.status === 'done' && file.report"
            @click.stop="emit('preview', file)"
            class="p-0.5 text-ink-400 hover:text-ink-700 transition-colors"
            title="预览原文"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            @click.stop="emit('remove', file.id)"
            class="p-0.5 text-ink-300 hover:text-status-fail transition-colors"
            title="删除"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="px-3 py-4 text-center text-ink-400 text-xs">
      暂无文件
    </div>

    <!-- Footer: inline compact uploader (supports click + drag-drop) -->
    <div class="border-t border-ink-100">
      <FileUploader
        compact
        compact-label="添加 Note 或 Bill"
        @files-added="files => emit('files-added', files)"
      />
    </div>
  </div>
</template>

<style scoped>
.grade-pass {
  @apply bg-status-pass/10 border-status-pass/30 text-status-pass;
}
.grade-warning {
  @apply bg-status-warning/10 border-status-warning/30 text-status-warning;
}
.grade-fail {
  @apply bg-status-fail/10 border-status-fail/30 text-status-fail;
}

.is-selected {
  @apply bg-paper-100;
  border-left: 2px solid var(--ink-700, #2b2820);
  padding-left: calc(0.75rem - 2px);
}

/* Hover-reveal only on devices that actually support hover (progressive enhancement) */
@media (hover: hover) and (pointer: fine) {
  .file-row .row-actions {
    opacity: 0;
    transition: opacity 150ms;
  }
  .file-row:hover .row-actions,
  .file-row.is-selected .row-actions {
    opacity: 1;
  }
}
</style>
