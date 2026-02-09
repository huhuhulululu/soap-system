import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL('..', import.meta.url))
      ]
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
