#!/usr/bin/env node
// S0(b) 冒烟：调用真实 parseBillListHtml（通过 tsx 子进程运行，保证 gate 不与代码脱钩）
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const runnerScript = resolve(here, 'smoke-bill-parse.runner.ts')

const tsxBin = resolve(here, '..', 'node_modules/.bin/tsx')
try {
  execSync(`"${tsxBin}" "${runnerScript}"`, {
    stdio: 'inherit',
    cwd: resolve(here, '..'),
  })
} catch (e) {
  process.exit(e.status || 1)
}
