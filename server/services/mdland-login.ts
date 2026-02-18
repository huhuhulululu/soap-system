/**
 * MDLand Auto-Login Service
 *
 * Uses Playwright to automatically login to MDLand EHR,
 * captures session cookies, and saves storage state.
 */

import { chromium, type Browser, type Page } from 'playwright'
import { saveCookies, loadCookies, hasCookies } from './automation-runner'
import path from 'path'

// ── Types ────────────────────────────────────────

export interface LoginResult {
  readonly success: boolean
  readonly cookieCount: number
  readonly error?: string
}

interface LoginOptions {
  readonly headless: boolean
  readonly timeout: number
}

// ── Constants ────────────────────────────────────

const MDLAND_URL = 'https://login.mdland.com/login_central.aspx'

const DEFAULT_OPTIONS: LoginOptions = {
  headless: true,
  timeout: 60000,
}

const LOGIN_SELECTORS = {
  USERNAME: '#id',
  PASSWORD: '#password',
  SUBMIT: '#loginBtn',
  ERROR_MSG: '.error-message, .login-error, .alert-danger, #errorMsg, .err',
  POST_LOGIN: 'text=Dashboard, text=Waiting Room, text=clinic_main',
} as const

// ── Helpers ──────────────────────────────────────

function saveFilteredCookies(storageState: { cookies: Array<{ domain: string }> }): number {
  const mdlandCookies = storageState.cookies.filter(
    (c) => c.domain.includes('mdland')
  )
  const filteredState = { ...storageState, cookies: mdlandCookies }
  saveCookies(filteredState)
  return mdlandCookies.length
}

// ── Try Saved Cookies ───────────────────────────

async function tryWithSavedCookies(
  browser: Browser,
  opts: LoginOptions
): Promise<LoginResult | null> {
  if (!hasCookies()) {
    return null
  }

  const storageState = loadCookies() as any

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    storageState,
  })

  try {
    const page = await context.newPage()
    page.setDefaultTimeout(opts.timeout)
    page.on('dialog', async (dialog) => { await dialog.accept() })

    await page.goto(MDLAND_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await page.waitForTimeout(3000)

    const isLoggedIn = await page.evaluate(() => {
      return document.location.href.includes('clinic_main')
    })

    if (isLoggedIn) {
      console.log('Saved cookies still valid! Reusing session.')
      const freshState = await context.storageState()
      const cookieCount = saveFilteredCookies(freshState)
      return { success: true, cookieCount }
    }

    console.log('Saved cookies expired, will login with credentials.')
    return null
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log('Cookie verification failed:', message)
    return null
  } finally {
    await context.close()
  }
}

// ── 2FA / Poll Helpers ──────────────────────────

const SCREENSHOT_DIR = path.resolve('data/screenshots')

async function handle2FAPage(page: Page): Promise<void> {
  // Screenshot for debugging
  const ssPath = path.join(SCREENSHOT_DIR, `2fa-${Date.now()}.png`)
  await page.screenshot({ path: ssPath }).catch(() => {})
  console.log('2FA screenshot saved:', ssPath)

  // Log page content for debugging
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? '').catch(() => '')
  console.log('2FA page content:', bodyText)

  // Try clicking any verify/continue/submit buttons
  const btnSelectors = [
    'input[type="submit"]', 'button[type="submit"]',
    '#btnVerify', '#btnContinue', '#btnSubmit',
    'a.btn', 'button.btn',
  ]
  for (const sel of btnSelectors) {
    const btn = await page.$(sel).catch(() => null)
    if (btn) {
      const text = await btn.textContent().catch(() => sel)
      console.log('2FA: clicking button:', text)
      await btn.click().catch(() => {})
      await page.waitForTimeout(3000)
      return
    }
  }

  // If no buttons found, try evaluating any auto-submit forms
  await page.evaluate(() => {
    const form = document.querySelector('form')
    if (form) form.submit()
  }).catch(() => {})
}

async function pollForLogin(
  page: Page,
  timeout: number
): Promise<{ success: boolean; error: string }> {
  const deadline = Date.now() + timeout
  let handled2FA = false

  while (Date.now() < deadline) {
    await page.waitForTimeout(2000)
    const url = page.url()
    console.log('Current URL:', url)

    if (url.includes('clinic_main')) {
      return { success: true, error: '' }
    }

    // Handle 2FA page once
    if (url.includes('2FA') && !handled2FA) {
      handled2FA = true
      console.log('Detected 2FA page, attempting to handle...')
      await handle2FAPage(page)
      continue
    }

    const errEl = await page.$(LOGIN_SELECTORS.ERROR_MSG).catch(() => null)
    if (errEl) {
      const text = await errEl.textContent().catch(() => '')
      return { success: false, error: text?.trim() || 'Login failed' }
    }
  }

  // Timeout — capture final state
  const ssPath = path.join(SCREENSHOT_DIR, `timeout-${Date.now()}.png`)
  await page.screenshot({ path: ssPath }).catch(() => {})
  console.log('Timeout screenshot:', ssPath, 'URL:', page.url())

  return { success: false, error: 'Login timeout. Please check credentials.' }
}

// ── Login Function ───────────────────────────────

export async function loginToMDLand(
  username: string,
  password: string,
  options: Partial<LoginOptions> = {}
): Promise<LoginResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const browser = await chromium.launch({
    headless: opts.headless,
  })

  try {
    // Step 1: Try saved cookies first
    const cookieResult = await tryWithSavedCookies(browser, opts)
    if (cookieResult) {
      return cookieResult
    }

    // Step 2: Fresh login with credentials
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 },
    })

    const page = await context.newPage()
    page.setDefaultTimeout(opts.timeout)

    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    console.log('Navigating to MDLand login page...')
    await page.goto(MDLAND_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })

    await page.waitForTimeout(2000)

    // Check if already logged in (redirected to clinic_main)
    const alreadyLoggedIn = await page.evaluate(() => {
      return document.location.href.includes('clinic_main')
    })

    if (alreadyLoggedIn) {
      console.log('Already logged in, saving session...')
      const storageState = await context.storageState()
      const cookieCount = saveFilteredCookies(storageState)
      return { success: true, cookieCount }
    }

    // Wait for login form
    console.log('Waiting for login form...')
    const passwordInput = await page.waitForSelector(LOGIN_SELECTORS.PASSWORD, {
      timeout: 10000,
    }).catch(() => null)

    if (!passwordInput) {
      return {
        success: false,
        cookieCount: 0,
        error: 'Login form not found. Page structure may have changed.',
      }
    }

    const usernameInput = await page.$(LOGIN_SELECTORS.USERNAME)
    if (!usernameInput) {
      return {
        success: false,
        cookieCount: 0,
        error: 'Username input not found. Page structure may have changed.',
      }
    }

    // Fill credentials
    console.log('Filling login credentials...')
    await usernameInput.fill(username)
    await passwordInput.fill(password)
    await page.waitForTimeout(300)

    // Submit form
    console.log('Submitting login form...')
    const submitButton = await page.$(LOGIN_SELECTORS.SUBMIT)
    if (submitButton) {
      await submitButton.click()
    } else {
      await passwordInput.press('Enter')
    }

    // Poll URL until clinic_main or timeout
    console.log('Waiting for login response...')
    const loginOutcome = await pollForLogin(page, opts.timeout)

    if (!loginOutcome.success) {
      return {
        success: false,
        cookieCount: 0,
        error: loginOutcome.error || 'Login failed',
      }
    }

    // Save session
    await page.waitForTimeout(2000)
    console.log('Login successful, capturing session...')

    const storageState = await context.storageState()
    const cookieCount = saveFilteredCookies(storageState)

    return { success: true, cookieCount }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Login error:', message)
    return {
      success: false,
      cookieCount: 0,
      error: message,
    }
  } finally {
    await browser.close()
  }
}
