<script setup>
import { useRoute } from 'vue-router'
import HeaderBar from './components/HeaderBar.vue'

const route = useRoute()

const navItems = [
  { name: '验证', path: '/' },
  { name: '续写', path: '/continue' },
  { name: '历史', path: '/history' }
]
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <HeaderBar />

    <!-- Navigation Tabs -->
    <nav class="border-b border-ink-200 bg-white">
      <div class="max-w-7xl mx-auto px-6">
        <div class="flex gap-8">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="py-4 px-1 border-b-2 font-medium text-sm transition-colors"
            :class="[
              route.path === item.path
                ? 'border-ink-800 text-ink-800'
                : 'border-transparent text-ink-500 hover:text-ink-700 hover:border-ink-300'
            ]"
          >
            {{ item.name }}
          </router-link>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="flex-1">
      <router-view />
    </main>

    <!-- Footer -->
    <footer class="border-t border-ink-100 py-4 mt-auto">
      <div class="max-w-7xl mx-auto px-6 text-center text-ink-400 text-sm">
        AChecker v1.0 · AC NOTE CHECK SYSTEM
      </div>
    </footer>
  </div>
</template>
