/**
 * Automation Runner — child process manager for Playwright MDLand automation
 *
 * Spawns and tracks headless Playwright automation processes.
 * Only one automation can run at a time (singleton lock).
 */

import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

// ── Types ────────────────────────────────────────

export type AutomationStatus = 'idle' | 'running' | 'done' | 'failed'

export interface AutomationJob {
  readonly batchId: string
  readonly startedAt: string
  readonly finishedAt: string | null
  readonly status: AutomationStatus
  readonly logs: readonly string[]
  readonly exitCode: number | null
}

// ── State ────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR || '/app/data'
const COOKIES_FILENAME = 'mdland-storage-state.json'

let currentJob: {
  batchId: string
  startedAt: string
  finishedAt: string | null
  status: AutomationStatus
  logs: string[]
  exitCode: number | null
  process: ChildProcess | null
} | null = null

// ── Cookie Management ────────────────────────────

function cookiesPath(): string {
  return path.join(DATA_DIR, COOKIES_FILENAME)
}

export function hasCookies(): boolean {
  return fs.existsSync(cookiesPath())
}

export function saveCookies(storageState: unknown): void {
  const dir = DATA_DIR
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(cookiesPath(), JSON.stringify(storageState, null, 2))
}

export function getCookiesInfo(): { exists: boolean; updatedAt: string | null } {
  const p = cookiesPath()
  if (!fs.existsSync(p)) {
    return { exists: false, updatedAt: null }
  }
  const stat = fs.statSync(p)
  return { exists: true, updatedAt: stat.mtime.toISOString() }
}

// ── Job Status ───────────────────────────────────

export function getJobStatus(batchId: string): AutomationJob | null {
  if (!currentJob || currentJob.batchId !== batchId) {
    return null
  }
  return {
    batchId: currentJob.batchId,
    startedAt: currentJob.startedAt,
    finishedAt: currentJob.finishedAt,
    status: currentJob.status,
    logs: currentJob.logs,
    exitCode: currentJob.exitCode,
  }
}

export function getActiveJob(): AutomationJob | null {
  if (!currentJob) return null
  return {
    batchId: currentJob.batchId,
    startedAt: currentJob.startedAt,
    finishedAt: currentJob.finishedAt,
    status: currentJob.status,
    logs: currentJob.logs,
    exitCode: currentJob.exitCode,
  }
}

export function isRunning(): boolean {
  return currentJob?.status === 'running'
}

// ── Start Automation ─────────────────────────────

export function startAutomation(batchId: string, apiBase: string): AutomationJob {
  if (isRunning()) {
    throw new Error(`Automation already running for batch ${currentJob!.batchId}`)
  }

  if (!hasCookies()) {
    throw new Error('MDLand cookies not uploaded. Please upload storage state first.')
  }

  const scriptPath = path.resolve(__dirname, '../../scripts/playwright/mdland-automation.ts')
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Automation script not found: ${scriptPath}`)
  }

  const args = [
    'tsx',
    scriptPath,
    batchId,
    '--headless',
    '--screenshot',
    '--api', apiBase,
    '--state', cookiesPath(),
  ]

  const now = new Date().toISOString()

  currentJob = {
    batchId,
    startedAt: now,
    finishedAt: null,
    status: 'running',
    logs: [],
    exitCode: null,
    process: null,
  }

  const appendLog = (line: string) => {
    if (!currentJob) return
    const timestamp = new Date().toISOString().slice(11, 19)
    currentJob.logs.push(`[${timestamp}] ${line}`)
    // Keep last 500 lines
    if (currentJob.logs.length > 500) {
      currentJob.logs.splice(0, currentJob.logs.length - 500)
    }
  }

  appendLog(`Starting automation for batch ${batchId}`)

  const child = spawn('npx', args, {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  currentJob.process = child

  child.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim())
    for (const line of lines) {
      appendLog(line)
    }
  })

  child.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim())
    for (const line of lines) {
      appendLog(`[stderr] ${line}`)
    }
  })

  child.on('close', (code) => {
    if (!currentJob) return
    currentJob.exitCode = code
    currentJob.finishedAt = new Date().toISOString()
    currentJob.status = code === 0 ? 'done' : 'failed'
    currentJob.process = null
    appendLog(`Process exited with code ${code}`)
  })

  child.on('error', (err) => {
    if (!currentJob) return
    currentJob.finishedAt = new Date().toISOString()
    currentJob.status = 'failed'
    currentJob.process = null
    appendLog(`Process error: ${err.message}`)
  })

  return {
    batchId: currentJob.batchId,
    startedAt: currentJob.startedAt,
    finishedAt: currentJob.finishedAt,
    status: currentJob.status,
    logs: currentJob.logs,
    exitCode: currentJob.exitCode,
  }
}

// ── Stop Automation ──────────────────────────────

export function stopAutomation(): boolean {
  if (!currentJob?.process) return false
  currentJob.process.kill('SIGTERM')
  return true
}
