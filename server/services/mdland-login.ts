/**
 * MDLand Auto-Login Service
 *
 * Uses Playwright to automatically login to MDLand EHR,
 * captures session cookies, and saves storage state.
 */

import { chromium, type Browser } from 'playwright'
import { saveCookies, loadCookies, hasCookies } from './automation-runner'

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

const MDLAND_URL = 'https://ehr.mdland.net'

const DEFAULT_OPTIONS: LoginOptions = {
  headless: true,
  timeout: 30000,
}

const LOGIN_SELECTORS = {
  USERNAME: 'input[name="userName"], input[name="username"], input[name="login"], input[type="text"][id*="user"], #userName',
  PASSWORD: 'input[name="password"], input[type="password"]',
  SUBMIT: 'input[type="submit"], button[type="submit"], #btnLogin, .login-btn',
  LOGIN_FORM: '#loginForm, form[action*="login"], form[action*="Login"]',
  ERROR_MSG: '.error-message, .login-error, .alert-danger, #errorMsg, .err',
  WORKAREA: 'iframe[name="workarea0"], #workarea0',
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

  const storageState = loadCookies() as { cookies: Array<{ domain: string }> }

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
      const wa0 = document.getElementById('workarea0')
      const sessionId = (window as unknown as Record<string, unknown>).g_sessionID
      return (wa0 !== null) || (sessionId !== undefined && sessionId !== '')
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

    // Check if already logged in (has workarea0)
    const alreadyLoggedIn = await page.evaluate(() => {
      return document.getElementById('workarea0') !== null
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

    // Wait for either success or error
    console.log('Waiting for login response...')

    const loginOutcome = await Promise.race([
      page.waitForSelector(LOGIN_SELECTORS.WORKAREA, { timeout: opts.timeout })
        .then(() => ({ success: true, error: '' })),

      page.waitForFunction(
        () => {
          const wa0 = document.getElementById('workarea0')
          const sessionId = (window as unknown as Record<string, unknown>).g_sessionID
          return (wa0 !== null) || (sessionId !== undefined && sessionId !== '')
        },
        { timeout: opts.timeout }
      ).then(() => ({ success: true, error: '' })),

      page.waitForSelector(LOGIN_SELECTORS.ERROR_MSG, { timeout: opts.timeout })
        .then(async (el) => {
          const text = await el.textContent().catch(() => '')
          return { success: false, error: text?.trim() || 'Login failed' }
        }),
    ]).catch(() => ({
      success: false,
      error: 'Login timeout. Please check credentials.',
    }))

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
