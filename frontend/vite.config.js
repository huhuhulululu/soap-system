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
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
})
