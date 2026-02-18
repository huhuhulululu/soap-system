/**
 * Automation Runner — child process manager for Playwright MDLand automation
 *
 * Spawns and tracks headless Playwright automation processes.
 * Only one automation can run at a time (singleton lock).
 */

import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

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

// ── Login State ─────────────────────────────────

export type LoginStatus = 'idle' | 'logging_in' | 'done' | 'failed'

let loginState: {
  status: LoginStatus
  error: string | null
} = { status: 'idle', error: null }

export function isLoggingIn(): boolean {
  return loginState.status === 'logging_in'
}

export function setLoginStatus(status: LoginStatus, error: string | null = null): void {
  loginState = { status, error }
}

export function getLoginStatus(): { status: LoginStatus; error: string | null } {
  return { ...loginState }
}

// ── State ────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR || '/app/data'
const COOKIES_FILENAME = 'mdland-storage-state.enc'
const ALGO = 'aes-256-gcm'

function getCookieKey(): Buffer {
  const raw = process.env.COOKIE_ENCRYPTION_KEY
  if (!raw) throw new Error('COOKIE_ENCRYPTION_KEY env var is required')
  return Buffer.from(raw, 'hex')
}

function encrypt(plaintext: string): Buffer {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getCookieKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: [iv 12B][tag 16B][ciphertext]
  return Buffer.concat([iv, tag, encrypted])
}

function decrypt(data: Buffer): string {
  const iv = data.subarray(0, 12)
  const tag = data.subarray(12, 28)
  const ciphertext = data.subarray(28)
  const decipher = crypto.createDecipheriv(ALGO, getCookieKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

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
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  const encrypted = encrypt(JSON.stringify(storageState))
  fs.writeFileSync(cookiesPath(), encrypted)
}

export function loadCookies(): unknown {
  const data = fs.readFileSync(cookiesPath())
  return JSON.parse(decrypt(data))
}

/**
 * Decrypt cookies to a temp file for Playwright, returns path.
 * Caller must clean up via cleanupTempCookies().
 */
const TEMP_COOKIES = path.join(DATA_DIR, '.tmp-cookies.json')

export function decryptCookiesToTempFile(): string {
  const plain = JSON.stringify(loadCookies(), null, 2)
  fs.writeFileSync(TEMP_COOKIES, plain, { mode: 0o600 })
  return TEMP_COOKIES
}

export function cleanupTempCookies(): void {
  try { fs.unlinkSync(TEMP_COOKIES) } catch { /* already gone */ }
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
    '--state', decryptCookiesToTempFile(),
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
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '/app/.playwright' },
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
    cleanupTempCookies()
    if (!currentJob) return
    currentJob.exitCode = code
    currentJob.finishedAt = new Date().toISOString()
    currentJob.status = code === 0 ? 'done' : 'failed'
    currentJob.process = null
    appendLog(`Process exited with code ${code}`)
  })

  child.on('error', (err) => {
    cleanupTempCookies()
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
