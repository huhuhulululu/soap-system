import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

// 浏览器环境: 将 Node.js 版 whitelist 重定向到 browser 版
// 拦截所有解析到 template-rule-whitelist.ts 的导入（相对路径/绝对路径均覆盖）
function whitelistBrowserPlugin() {
  const nodeVersion = path.resolve(__dirname, '..', 'src/parser/template-rule-whitelist.ts')
  const browserVersion = path.resolve(__dirname, '..', 'src/parser/template-rule-whitelist.browser.ts')
  return {
    name: 'whitelist-browser-redirect',
    enforce: 'pre',
    resolveId(source, importer) {
      // 匹配裸名
      if (source === 'template-rule-whitelist' || source.endsWith('/template-rule-whitelist')) {
        return browserVersion
      }
      // 匹配相对路径 (已由 Vite 解析为绝对路径前的原始 source)
      if (importer && (source === './template-rule-whitelist' || source === '../parser/template-rule-whitelist')) {
        return browserVersion
      }
    },
    load(id) {
      // 兜底: 如果其他插件已经解析到 Node.js 版本, 重定向
      if (id === nodeVersion) {
        return { id: browserVersion }
      }
    }
  }
}

export default defineConfig({
  plugins: [vue(), whitelistBrowserPlugin()],
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
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
})
