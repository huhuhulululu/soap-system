import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export default defineConfig(async () => {
  const rootDir = fileURLToPath(new URL('.', import.meta.url))
  const plugins: any[] = []
  try {
    const vue = (await import('./frontend/node_modules/@vitejs/plugin-vue/dist/index.mjs')).default
    plugins.push(vue())
  } catch {
    // Fallback for environments without frontend deps: keep non-Vue tests runnable.
  }

  return {
    plugins,
    resolve: {
      alias: [
        {
          find: /^vue\/server-renderer$/,
          replacement: path.resolve(rootDir, 'frontend/node_modules/vue/server-renderer/index.mjs'),
        },
        {
          find: /^vue$/,
          replacement: path.resolve(rootDir, 'frontend/node_modules/vue/dist/vue.runtime.esm-bundler.js'),
        },
      ],
    },
    test: {
      globals: true,
    },
  }
})
