<script setup>
// HeaderBar - 顶部导航栏
</script>

<template>
  <header class="bg-white border-b border-ink-100 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <!-- Logo & Title -->
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-ink-800 rounded-lg flex items-center justify-center">
          <svg class="w-6 h-6 text-paper-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 class="font-display text-xl font-semibold text-ink-900 tracking-tight">
            AChecker
          </h1>
          <p class="text-xs text-ink-400 font-medium">Optum Note 验证系统</p>
        </div>
      </div>

      <!-- Right Actions -->
      <div class="flex items-center gap-4">
        <!-- Version Badge -->
        <span class="px-2.5 py-1 bg-paper-200 text-ink-500 text-xs font-mono rounded-md">
          v1.0
        </span>

        <!-- Help Link -->
        <button class="text-ink-400 hover:text-ink-600 transition-colors">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>
