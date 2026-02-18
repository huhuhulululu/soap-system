/**
 * Manual MDLand login — opens visible browser, waits for login, captures cookies.
 * Run: npx tsx scripts/capture-cookies.ts
 */
import { chromium } from 'playwright'

const MDLAND_URL = 'https://login.mdland.com/login_central.aspx'
const SERVER_URL = process.env.SERVER_URL || 'https://ac.aanao.cc'

async function main() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await context.newPage()

  page.on('dialog', async (d) => { await d.accept() })

  console.log('Opening MDLand login page...')
  console.log('Please login manually (including 2FA).')
  console.log('The script will detect when you reach clinic_main.\n')

  await page.goto(MDLAND_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })

  // Poll until clinic_main
  while (true) {
    await page.waitForTimeout(2000)
    const url = page.url()
    if (url.includes('clinic_main')) {
      console.log('Login detected! Capturing cookies...')
      break
    }
  }

  await page.waitForTimeout(2000)
  const storageState = await context.storageState()
  const mdlandCookies = storageState.cookies.filter((c) => c.domain.includes('mdland'))
  const filtered = { ...storageState, cookies: mdlandCookies }

  console.log(`Captured ${mdlandCookies.length} MDLand cookies.`)

  // Upload to server
  const res = await fetch(`${SERVER_URL}/api/automate/cookies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filtered),
  })
  const data = await res.json()
  console.log('Upload result:', data)

  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
