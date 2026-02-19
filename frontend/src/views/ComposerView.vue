<script setup>
import { ref, computed, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const mode = ref(route.query.mode === 'continue' ? 'continue' : 'write')

const WriterPanel = defineAsyncComponent(() => import('../components/composer/WriterPanel.vue'))
const ContinuePanel = defineAsyncComponent(() => import('../components/composer/ContinuePanel.vue'))
const currentPanel = computed(() => mode.value === 'write' ? WriterPanel : ContinuePanel)

function setMode(m) {
  mode.value = m
  router.replace({ query: m === 'continue' ? { mode: 'continue' } : {} })
}
</script>

<template>
  <div>
    <div class="flex justify-center gap-1 pt-6">
      <button v-for="m in [{ k: 'write', l: '编写' }, { k: 'continue', l: '续写' }]" :key="m.k"
        @click="setMode(m.k)"
        class="px-5 py-1.5 text-sm font-medium rounded-lg border transition-colors cursor-pointer"
        :class="mode === m.k ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-500 hover:border-ink-400'">
        {{ m.l }}
      </button>
    </div>
    <component :is="currentPanel" />
  </div>
</template>
