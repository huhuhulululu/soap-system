<script setup>
import { ref, computed, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const initialMode = route.query.mode === 'continue' ? 'continue' : route.query.mode === 'ai' ? 'ai' : 'write'
const mode = ref(initialMode)

const WriterPanel = defineAsyncComponent(() => import('../components/composer/WriterPanel.vue'))
const ContinuePanel = defineAsyncComponent(() => import('../components/composer/ContinuePanel.vue'))
const AIWriterPanel = defineAsyncComponent(() => import('../components/composer/AIWriterPanel.vue'))

const currentPanel = computed(() => {
  if (mode.value === 'ai') return AIWriterPanel
  if (mode.value === 'continue') return ContinuePanel
  return WriterPanel
})

function setMode(m) {
  mode.value = m
  const query = m === 'write' ? {} : { mode: m }
  router.replace({ query })
}
</script>

<template>
  <div>
    <div class="flex justify-center gap-1 pt-6">
      <button v-for="m in [{ k: 'write', l: '编写' }, { k: 'ai', l: 'AI 生成' }, { k: 'continue', l: '续写' }]" :key="m.k"
        @click="setMode(m.k)"
        class="px-5 py-1.5 text-sm font-medium rounded-lg border transition-colors cursor-pointer"
        :class="mode === m.k
          ? (m.k === 'ai' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-ink-800 text-paper-50 border-ink-800')
          : 'border-ink-200 text-ink-500 hover:border-ink-400'">
        {{ m.l }}
      </button>
    </div>
    <component :is="currentPanel" />
  </div>
</template>
