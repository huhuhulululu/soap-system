import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

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
      '@': '/src',
      // 浏览器环境使用 .browser 版本
      '../parser/template-rule-whitelist': path.resolve(__dirname, '../src/parser/template-rule-whitelist.browser.ts')
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
})
