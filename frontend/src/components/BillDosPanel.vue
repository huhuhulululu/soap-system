<script setup>
import { computed } from 'vue'

const props = defineProps({
  bill: { type: Object, default: null },         // BillList
  matchResults: { type: Array, default: null },  // MatchResult[]
  error: { type: String, default: '' },
})

const emit = defineEmits(['clear'])

const stats = computed(() => {
  const r = props.matchResults || []
  return {
    match: r.filter(x => x.status === 'match').length,
    diff: r.filter(x => x.status === 'diff').length,
    missing: r.filter(x => x.status === 'missing_dos').length,
  }
})

function statusIcon(s) {
  return s === 'match' ? '✓' : s === 'diff' ? '⚠' : '✗'
}

function statusClass(s) {
  return s === 'match' ? 'text-green-600' : s === 'diff' ? 'text-yellow-600' : 'text-red-600'
}

function shortDos(d) {
  const m = d.match(/^(\d{2})\/(\d{2})\/\d{4}$/)
  return m ? `${m[1]}/${m[2]}` : d
}
</script>

<template>
  <div class="card overflow-hidden">
    <!-- Error -->
    <div v-if="error" class="p-4 bg-red-50 border-l-4 border-red-400">
      <p class="text-sm text-red-700">Bill 解析失败：{{ error }}</p>
      <button @click="emit('clear')" class="mt-2 text-xs text-red-600 hover:underline">移除 Bill</button>
    </div>

    <template v-else-if="bill && matchResults">
      <!-- Header Summary -->
      <div class="px-4 py-3 bg-paper-100 border-b border-ink-100">
        <div class="flex items-center justify-between mb-1">
          <h3 class="font-display text-sm font-semibold text-ink-800">Bill vs Note</h3>
          <button @click="emit('clear')" class="text-xs text-ink-400 hover:text-red-500">清空</button>
        </div>
        <p class="text-xs text-ink-600 truncate">
          {{ bill.patient }} · {{ bill.insurance }} · {{ bill.rows.length }} DOS · ${{ bill.totalCharge.toFixed(0) }}
        </p>
      </div>

      <!-- Stats bar -->
      <div class="px-4 py-2 flex gap-4 text-xs border-b border-ink-100">
        <span class="text-green-600">✓ {{ stats.match }}</span>
        <span class="text-yellow-600">⚠ {{ stats.diff }}</span>
        <span class="text-red-600">✗ {{ stats.missing }}</span>
      </div>

      <!-- Rows -->
      <div class="divide-y divide-ink-100">
        <div v-for="(r, i) in matchResults" :key="i" class="px-4 py-2.5">
          <div class="flex items-start gap-2">
            <span :class="statusClass(r.status)" class="font-bold text-sm">{{ statusIcon(r.status) }}</span>
            <span class="font-mono text-xs text-ink-700 w-12 shrink-0">{{ shortDos(r.dos) }}</span>
            <div class="flex-1 min-w-0">
              <template v-if="r.status === 'match'">
                <div class="text-xs text-ink-600 truncate">
                  {{ r.billIcd.join('/') }} · {{ r.billCpt.join('·') }}
                </div>
              </template>
              <template v-else-if="r.status === 'diff'">
                <div class="text-xs text-ink-600">
                  <span v-if="r.icdMissing.length" class="text-yellow-700">ICD 缺失: {{ r.icdMissing.join(', ') }}</span>
                  <span v-if="r.icdMissing.length && r.cptMissing.length"> · </span>
                  <span v-if="r.cptMissing.length" class="text-yellow-700">CPT 缺失: {{ r.cptMissing.join(', ') }}</span>
                </div>
              </template>
              <template v-else>
                <div class="text-xs text-red-700">Note 无此 DOS</div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty state when no bill loaded -->
    <div v-else class="p-4 text-xs text-ink-400">
      等待 Bill 文件
    </div>
  </div>
</template>
