<script setup>
import { ref, onErrorCaptured } from 'vue'

const emit = defineEmits(['retry'])
const error = ref(null)

onErrorCaptured((err) => {
  error.value = err
  return false
})

function retry() {
  error.value = null
  emit('retry')
}
</script>

<template>
  <div v-if="error" class="bg-paper-100 border border-status-fail/30 rounded-lg p-6 text-center">
    <div class="text-status-fail text-lg font-medium mb-2">出错了</div>
    <div class="text-ink-500 text-sm mb-4">{{ error.message }}</div>
    <button @click="retry" class="btn-primary">重试</button>
  </div>
  <slot v-else />
</template>
