/**
 * MDLand SOAP/ICD/CPT Batch Scraper
 *
 * Two-pass strategy:
 *   Pass 1: Scan all visits, collect SOAP/ICD/CPT
 *   Pass 2: For patients with NO billing data at all, download Intake Form
 *
 * Usage:
 *   npx tsx ccnote/scraper.ts                    (pass 1: collect data)
 *   npx tsx ccnote/scraper.ts --headless         (headless mode)
 *   npx tsx ccnote/scraper.ts --start 50         (resume from patient #50)
 *   npx tsx ccnote/scraper.ts --intake-only      (pass 2: download intake forms)
 */
import { chromium, type Page, type BrowserContext } from 'playwright'
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

const BASE_DIR = dirname(__filename)
const TASKS_PATH = join(BASE_DIR, 'scrape-tasks.json')
const OUTPUT_JSON = join(BASE_DIR, 'scraped-data.json')
const OUTPUT_EXCEL = join(BASE_DIR, 'scraped-data.xlsx')
const INTAKE_DIR = join(BASE_DIR, 'intake-forms')
const LOG_FILE = join(BASE_DIR, 'scraper.log')

/** Write to both console and log file (unbuffered) */
function log(msg: string): void {
  const line = msg
  console.log(line)
  appendFileSync(LOG_FILE, line + '\n')
}

interface ScrapedVisit {
  readonly name: string
  readonly dob: string
  readonly insurance: string
  readonly subject: string
  readonly apptTime: string
  readonly apptDate: string
  readonly visitId: string
  readonly status: string
  readonly icd: readonly string[]
  readonly cpt: readonly string[]
  readonly soap: {
    readonly subjective: string
    readonly objective: string
    readonly assessment: string
    readonly plan: string
  }
}

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    headless: args.includes('--headless'),
    start: parseInt(args.find((_, i, a) => a[i - 1] === '--start') || '0', 10),
    intakeOnly: args.includes('--intake-only'),
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Run a promise with a timeout — rejects if it takes too long */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)),
  ])
}

class MDLandScraper {
  private page!: Page
  private context!: BrowserContext
  private results: ScrapedVisit[] = []
  private readonly headless: boolean
  private waitingRoomReady = false

  constructor(headless: boolean) {
    this.headless = headless
    if (!existsSync(INTAKE_DIR)) mkdirSync(INTAKE_DIR, { recursive: true })
  }

  async init(): Promise<void> {
    const browser = await chromium.launch({ headless: this.headless, slowMo: 50 })
    this.context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    this.page = await this.context.newPage()
    this.page.setDefaultTimeout(15000)
    // Auto-accept all dialogs (including from iframes)
    this.page.on('dialog', async d => {
      log(`      [dialog-auto] ${d.type()}: ${d.message().slice(0, 80)}`)
      try { await d.accept() } catch { /* already handled */ }
    })
    // Override confirm/alert in all frames to prevent blocking
    await this.page.addInitScript(() => {
      (window as any).__name = (fn: any) => fn
      window.confirm = () => true
      window.alert = () => {}
    })
  }

  async loginFresh(): Promise<boolean> {
    const envPath = join(BASE_DIR, '.env')
    if (!existsSync(envPath)) { console.error('.env not found'); return false }
    const vars: Record<string, string> = {}
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^(\w+)=(.+)$/)
      if (m) vars[m[1]] = m[2]
    }

    log(`Logging in as ${vars.MDLAND_USER}...`)
    await this.page.goto('https://login.mdland.com/login_central.aspx', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(2000)
    await this.page.locator('input[type="text"]').first().fill(vars.MDLAND_USER)
    await sleep(300)
    await this.page.locator('input[type="password"]').first().fill(vars.MDLAND_PASS)
    await sleep(300)
    await this.page.getByText('Login').click()

    for (let i = 0; i < 30; i++) {
      await sleep(2000)
      if (this.page.url().includes('clinic_main')) {
        log('Login successful!')
        await sleep(3000)
        return true
      }
    }
    log('Login failed - did not reach clinic_main')
    return false
  }

  private async ensureWaitingRoom(): Promise<void> {
    log('    [wr] checking...')
    const searchFrame = this.page.frameLocator('iframe[name="searchframe"]')
    let searchVisible = false
    try {
      await searchFrame.locator('#searchBy').waitFor({ state: 'visible', timeout: 3000 })
      searchVisible = true
    } catch {}

    if (searchVisible && this.waitingRoomReady) { log('    [wr] already ready'); return }

    log('    [wr] clicking Waiting Room...')
    await this.page.locator('td:has-text("Waiting Room")').first().click({ timeout: 5000 })
    await sleep(2000)
    log('    [wr] selecting One Patient...')
    const wlFrame = this.page.frameLocator('iframe[name="waittinglistframe"]')
    await wlFrame.getByRole('cell', { name: 'One Patient', exact: true }).getByRole('radio').click({ timeout: 10000 })
    await sleep(1000)
    await searchFrame.locator('#searchBy').waitFor({ state: 'visible', timeout: 10000 })
    log('    [wr] ready')
    this.waitingRoomReady = true
  }

  private async searchPatient(dob: string, name: string): Promise<boolean> {
    await this.ensureWaitingRoom()
    log(`    [search] ${name} (${dob})`)
    const searchFrame = this.page.frameLocator('iframe[name="searchframe"]')
    await withTimeout(searchFrame.locator('#searchBy').selectOption('Patient DOB'), 8000, 'selectDOB')
    await sleep(200)
    await withTimeout(searchFrame.locator('#searchStr').fill(dob), 5000, 'fillDOB')
    await sleep(200)
    await withTimeout(searchFrame.locator('#searchStr').press('Enter'), 5000, 'pressEnter')
    await sleep(2500)

    const lastName = name.split(',')[0].trim()
    try {
      const link = searchFrame.locator(`a:has-text("${lastName}")`).first()
      await link.click({ timeout: 5000 })
      await sleep(3000)
      log(`    [search] found`)
      return true
    } catch {
      log(`  Patient not found: ${name} (${dob})`)
      return false
    }
  }

  private async getVisitList(): Promise<Array<{ idx: number; visitId: string; apptDate: string; subject: string }>> {
    const wlFrame = this.page.frameLocator('iframe[name="waittinglistframe"]')
    const innerFrame = wlFrame.frameLocator('iframe[name="waittinglistFrame"]')

    await innerFrame.locator('tr[id^="trt"]:not([id="trt"])').first().waitFor({ state: 'visible', timeout: 10000 })

    const raw = await innerFrame.locator('tr[id^="trt"]:not([id="trt"])').evaluateAll(rows => {
      return rows.map(tr => {
        const idx = parseInt(tr.id.replace('trt', ''), 10) || 0
        const visitIdInput = tr.querySelector('input[name="visitid"]') as HTMLInputElement | null
        const visitId = visitIdInput?.value || ''
        const title = tr.getAttribute('title') || ''
        const dosMatch = title.match(/DOS:\s*(\d{1,2}\/\d{1,2}\/\d{4})/)
        const apptMatch = title.match(/Appointment Time:\s*(\d{1,2}\/\d{1,2}\/\d{4})/)
        const apptDate = dosMatch?.[1] || apptMatch?.[1] || ''
        const cells = tr.querySelectorAll('td')
        let subject = ''
        for (const cell of Array.from(cells)) {
          const t = (cell as HTMLElement).innerText?.trim()
          if (t && t.length > 2 && !t.includes('document.') && !/^\d+$/.test(t)) {
            if (/[A-Z]{2,}/.test(t)) { subject = t; break }
          }
        }
        return { idx, visitId, apptDate, subject }
      })
    })

    return raw.filter(v => v.visitId.length >= 6)
  }

  private async clickDialogButton(buttonText: string): Promise<boolean> {
    try {
      return await Promise.race([
        this.page.evaluate((text) => {
          const priorityPaths = [
            ['waittinglistframe', 'waittinglistFrame'],
            ['waittinglistframe'],
            ['searchframe'],
            ['workarea0'],
          ]
          // Also check top-level document for any dialog
          const allDocs: Document[] = []
          for (const path of priorityPaths) {
            let doc: Document | null = document
            for (const name of path) {
              const f = doc.querySelector('iframe[name="' + name + '"]') as HTMLIFrameElement
              doc = f?.contentDocument || null
              if (!doc) break
            }
            if (doc) allDocs.push(doc)
          }
          allDocs.push(document)

          for (const doc of allDocs) {
            const cells = doc.querySelectorAll('td')
            for (const c of cells) {
              if ((c as HTMLElement).innerText?.trim() === text) {
                (c as HTMLElement).click()
                return true
              }
            }
          }
          return false
        }, buttonText),
        sleep(3000).then(() => false),
      ]) as boolean
    } catch {
      return false
    }
  }

  private async dismissDialogs(): Promise<void> {
    await this.clickDialogButton('No')
  }

  private async acceptPTNoteDialog(): Promise<void> {
    // The "Are you sure you want to open this PT Note?" dialog
    // appears in waittinglistFrame. Click "Yes" to proceed.
    for (let i = 0; i < 8; i++) {
      const clicked = await this.clickDialogButton('Yes')
      if (clicked) {
        // There might be a second "Yes" (office visit + PT Note)
        await sleep(500)
        await this.clickDialogButton('Yes')
        return
      }
      await sleep(500)
    }
  }

  private async openVisit(idx: number): Promise<void> {
    log(`      [open] moveInMe(${idx})`)
    const wlFrame = this.page.frameLocator('iframe[name="waittinglistframe"]')
    const innerFrame = wlFrame.frameLocator('iframe[name="waittinglistFrame"]')
    await innerFrame.locator('body').evaluate((_, i) => {
      (window as any).moveInMe(i)
    }, idx)

    // Wait for visit to load by checking workarea0 has content
    for (let w = 0; w < 10; w++) {
      const hasContent = await Promise.race([
        this.page.evaluate(() => {
          const wa = document.querySelector('iframe[name="workarea0"]') as HTMLIFrameElement
          if (!wa?.contentDocument) return false
          // Visit loaded = has MenuFrame or diagnose iframe
          return !!(wa.contentDocument.querySelector('iframe[name="MenuFrame"]') ||
                    wa.contentDocument.querySelector('iframe[name="diagnose"]'))
        }),
        sleep(2000).then(() => false),
      ])
      if (hasContent) { log(`      [open] loaded at ${w}s`); break }
      if (w === 9) log(`      [open] timeout`)
      await sleep(1000)
    }
    await sleep(1000)
  }

  /** Read ICD/CPT from the diagnose iframe (only selected/actual codes) */
  private async extractCodesFromDiagnose(): Promise<{ icd: string[]; cpt: string[] }> {
    try {
      const codes = await Promise.race([
        this.page.evaluate(() => {
          try {
            const wa = document.querySelector('iframe[name="workarea0"]') as HTMLIFrameElement
            if (!wa?.contentDocument) return { icd: [] as string[], cpt: [] as string[] }

            const diagnose = wa.contentDocument.querySelector('iframe[name="diagnose"]') as HTMLIFrameElement
            if (!diagnose?.contentDocument) return { icd: [] as string[], cpt: [] as string[] }

            const icdSelect = diagnose.contentDocument.querySelector('select[name="list"]') as HTMLSelectElement
            const cptSelect = diagnose.contentDocument.querySelector('select[name="list_cpt"]') as HTMLSelectElement

            const getItems = (sel: HTMLSelectElement | null, maxReasonable: number): string[] => {
              if (!sel) return []
              const opts = Array.from(sel.options).map(o => o.text.trim()).filter(t => t.length > 2)
              return opts.length <= maxReasonable ? opts : []
            }

            return {
              icd: getItems(icdSelect, 8),
              cpt: getItems(cptSelect, 6),
            }
          } catch {
            return { icd: [] as string[], cpt: [] as string[] }
          }
        }),
        sleep(5000).then(() => ({ icd: [] as string[], cpt: [] as string[] })),
      ])
      return codes
    } catch {
      return { icd: [], cpt: [] }
    }
  }

  /** Read ICD/CPT from PT Note body text (numbered format) */
  private async extractCodesFromPTNote(): Promise<{ icd: string[]; cpt: string[] }> {
    const codes = await this.page.evaluate(() => {
      try {
        const wa = document.querySelector('iframe[name="workarea0"]') as HTMLIFrameElement
        if (!wa?.contentDocument) return { icd: '', cpt: '' }
        const ptnote = wa.contentDocument.querySelector('iframe[name="ptnote"]') as HTMLIFrameElement
        if (!ptnote?.contentDocument) return { icd: '', cpt: '' }
        const text = ptnote.contentDocument.body?.innerText || ''
        const icdMatch = text.match(/ICD[\s\S]*?(?=CPT|$)/i)
        const cptMatch = text.match(/CPT[\s\S]*?(?=\n\n|PT Note Template|$)/i)
        return { icd: icdMatch?.[0] || '', cpt: cptMatch?.[0] || '' }
      } catch {
        return { icd: '', cpt: '' }
      }
    })

    const parseLines = (raw: string): string[] =>
      raw.split('\n').map(l => l.trim())
        .filter(l => /^\(\d+\)/.test(l))
        .map(l => l.replace(/^\(\d+\)\s*/, ''))

    return { icd: parseLines(codes.icd), cpt: parseLines(codes.cpt) }
  }

  /** Click PT Note in MenuFrame (reliable method from debug-visit-switch) */
  private async loadPTNoteViaMenu(): Promise<boolean> {
    log('      [pt] clicking menu...')
    try {
      await Promise.race([
        this.page.evaluate(() => {
          const wa = document.querySelector('iframe[name="workarea0"]') as HTMLIFrameElement
          if (!wa?.contentDocument) return
          const menu = wa.contentDocument.querySelector('iframe[name="MenuFrame"]') as HTMLIFrameElement
          if (!menu?.contentDocument) return
          const cells = menu.contentDocument.querySelectorAll('td')
          for (const c of cells) {
            if ((c as HTMLElement).innerText?.trim() === 'PT Note') {
              (c as HTMLElement).click()
              return
            }
          }
        }),
        sleep(5000),
      ])
    } catch {
      log('      [pt] menu click failed')
      return false
    }
    await sleep(1000)

    // Handle dialogs — click Yes for up to 3 rounds with timeout protection
    log('      [pt] handling dialogs...')
    for (let d = 0; d < 3; d++) {
      await sleep(600)
      try {
        const clicked = await withTimeout(this.clickDialogButton('Yes'), 5000, `dialog-${d}`)
        if (clicked) {
          log(`      [pt] dialog ${d}: Yes`)
        } else {
          break
        }
      } catch {
        log(`      [pt] dialog ${d}: timeout`)
        break
      }
    }

    // Wait for ptnote frame to have content (up to 10s)
    // Check multiple signals: sub-iframes (TinyMCE), body text, or SOAP labels
    log('      [pt] waiting for load...')
    for (let w = 0; w < 10; w++) {
      try {
        const status = await Promise.race([
          this.page.evaluate(() => {
            const wa = document.querySelector('iframe[name="workarea0"]') as HTMLIFrameElement
            if (!wa?.contentDocument) return 'no-workarea'
            const ptnote = wa.contentDocument.querySelector('iframe[name="ptnote"]') as HTMLIFrameElement
            if (!ptnote?.contentDocument) return 'no-ptnote'
            const ptDoc = ptnote.contentDocument
            // Signal 1: TinyMCE iframes present
            const iframes = ptDoc.querySelectorAll('iframe')
            if (iframes.length > 0) return 'loaded-iframes'
            // Signal 2: Body has SOAP-related text
            const bodyText = ptDoc.body?.innerText || ''
            if (bodyText.includes('Subjective') || bodyText.includes('SOAP') || bodyText.includes('Assessment')) return 'loaded-text'
            // Signal 3: Any textarea or input (fallback form)
            if (ptDoc.querySelectorAll('textarea').length > 0) return 'loaded-textarea'
            // Signal 4: Body has substantial content
            if (bodyText.trim().length > 100) return 'loaded-content'
            return 'empty'
          }),
          sleep(2000).then(() => 'timeout' as string),
        ])
        if (status.startsWith('loaded')) {
          log(`      [pt] loaded at ${w}s (${status})`)
          return true
        }
        if (status === 'no-workarea' || status === 'no-ptnote') {
          // Frame not ready yet, also try clicking Yes again in case dialog appeared late
          await this.clickDialogButton('Yes').catch(() => false)
        }
      } catch {
        // evaluate failed, keep trying
      }
      await sleep(1000)
    }
    log('      [pt] timeout — not loaded')
    return false
  }

  /** Read SOAP text from ptnote TinyMCE iframes */
  private async readSOAPFromPTNote(): Promise<{ subjective: string; objective: string; assessment: string; plan: string }> {
    const result = await this.page.evaluate(() => {
      try {
        const wa = document.querySelector('iframe[name="workarea0"]') as HTMLIFrameElement
        if (!wa?.contentDocument) return { subjective: '', objective: '', assessment: '', plan: '', debug: 'no-workarea' }
        const ptnote = wa.contentDocument.querySelector('iframe[name="ptnote"]') as HTMLIFrameElement
        if (!ptnote?.contentDocument) return { subjective: '', objective: '', assessment: '', plan: '', debug: 'no-ptnote' }
        const ptDoc = ptnote.contentDocument

        // Debug: list all iframes in ptnote
        const allIframes = Array.from(ptDoc.querySelectorAll('iframe')).map(f => ({
          id: f.id || '(no-id)',
          name: f.name || '(no-name)',
          hasBody: !!f.contentDocument?.body,
          textLen: f.contentDocument?.body?.innerText?.trim().length || 0,
        }))

        // Debug: list all textareas
        const allTextareas = Array.from(ptDoc.querySelectorAll('textarea')).map(t => ({
          id: t.id || '(no-id)',
          name: t.name || '(no-name)',
          textLen: t.value?.length || 0,
        }))

        function getIframeText(name: string): string {
          const iframe = ptDoc.querySelector('iframe[id="' + name + '"]') as HTMLIFrameElement
          if (!iframe?.contentDocument?.body) return ''
          return iframe.contentDocument.body.innerText?.trim() || ''
        }

        // Also try textarea fallback
        function getTextareaText(name: string): string {
          const ta = ptDoc.querySelector('textarea[id="' + name + '"]') as HTMLTextAreaElement
          return ta?.value?.trim() || ''
        }

        const soap = {
          subjective: getIframeText('SOAPtext0_ifr') || getTextareaText('SOAPtext0'),
          objective: getIframeText('SOAPtext1_ifr') || getTextareaText('SOAPtext1'),
          assessment: getIframeText('SOAPtext2_ifr') || getTextareaText('SOAPtext2'),
          plan: getIframeText('SOAPtext3_ifr') || getTextareaText('SOAPtext3'),
        }

        return {
          ...soap,
          debug: JSON.stringify({ iframes: allIframes.slice(0, 10), textareas: allTextareas.slice(0, 10) }),
        }
      } catch (e) {
        return { subjective: '', objective: '', assessment: '', plan: '', debug: `error: ${e}` }
      }
    })

    if (result.debug) {
      log(`      [soap-debug] ${result.debug.slice(0, 300)}`)
    }

    return {
      subjective: result.subjective,
      objective: result.objective,
      assessment: result.assessment,
      plan: result.plan,
    }
  }

  private async extractSOAPAndCodes(): Promise<{
    soap: { subjective: string; objective: string; assessment: string; plan: string }
    icd: string[]
    cpt: string[]
    opened: boolean
  }> {
    const empty = { subjective: '', objective: '', assessment: '', plan: '' }

    // Step 1: Try reading ICD/CPT from diagnose iframe
    let { icd, cpt } = await this.extractCodesFromDiagnose()

    // Step 2: Load PT Note via MenuFrame click
    const ptNoteLoaded = await this.loadPTNoteViaMenu()
    let soap = empty

    if (ptNoteLoaded) {
      // Read SOAP
      soap = await this.readSOAPFromPTNote()

      // If diagnose didn't have codes, try PT Note text
      if (icd.length === 0 && cpt.length === 0) {
        const ptNoteCodes = await this.extractCodesFromPTNote()
        icd = ptNoteCodes.icd
        cpt = ptNoteCodes.cpt
      }
    }

    return { soap, icd, cpt, opened: ptNoteLoaded }
  }

  /** Click Return button to go back from PT Note to visit page */
  private async returnFromPTNote(): Promise<void> {
    try {
      await this.page.evaluate(() => {
        const wa = document.querySelector('iframe[name="workarea0"]') as HTMLIFrameElement
        if (!wa?.contentDocument) return
        // Try clicking "Return" in the visit page
        const cells = wa.contentDocument.querySelectorAll('td')
        for (const c of cells) {
          if ((c as HTMLElement).innerText?.trim() === 'Return') {
            (c as HTMLElement).click()
            return
          }
        }
        // Also try MenuFrame for navigation back
        const menu = wa.contentDocument.querySelector('iframe[name="MenuFrame"]') as HTMLIFrameElement
        if (menu?.contentDocument) {
          const menuCells = menu.contentDocument.querySelectorAll('td')
          for (const c of menuCells) {
            const text = (c as HTMLElement).innerText?.trim()
            if (text === 'ICD/CPT' || text === 'Diagnose') {
              (c as HTMLElement).click()
              return
            }
          }
        }
      })
      await sleep(1500)
    } catch {}
  }

  private async closeVisit(): Promise<void> {
    // closeMe() works from any sub-page (including PT Note)
    try {
      await Promise.race([
        this.page.evaluate(() => {
          const wa = document.querySelector('iframe[name="workarea0"]') as HTMLIFrameElement
          if (wa?.contentWindow && typeof (wa.contentWindow as any).closeMe === 'function') {
            (wa.contentWindow as any).closeMe()
          }
        }),
        sleep(5000),
      ])
      await sleep(2000)
    } catch {}

    // Click Close image on OV tab as fallback
    try {
      await Promise.race([
        this.page.evaluate(() => {
          const imgs = document.querySelectorAll('img[alt="Close"]')
          for (const img of imgs) {
            const parent = img.closest('table')
            if (parent && (parent as HTMLElement).innerText?.includes('OV ')) {
              (img as HTMLElement).click()
              return true
            }
          }
          return false
        }),
        sleep(3000),
      ])
      await sleep(1000)
    } catch {}

    // Dismiss any lingering dialogs
    for (let i = 0; i < 3; i++) {
      try { await withTimeout(this.clickDialogButton('Yes'), 3000, 'close-yes') } catch {}
      try { await withTimeout(this.clickDialogButton('No'), 3000, 'close-no') } catch {}
      await sleep(500)
    }

    // Wait for visit list to be visible again (confirms we're back)
    try {
      const wlFrame = this.page.frameLocator('iframe[name="waittinglistframe"]')
      const innerFrame = wlFrame.frameLocator('iframe[name="waittinglistFrame"]')
      await innerFrame.locator('tr[id^="trt"]:not([id="trt"])').first().waitFor({ state: 'visible', timeout: 8000 })
      log('      [close] back to visit list')
    } catch {
      log('      [close] visit list not visible, will retry')
    }
  }

  // ── Pass 1: Collect SOAP/ICD/CPT ──────────────────

  async scrapeAll(startIdx: number): Promise<void> {
    const tasks = JSON.parse(readFileSync(TASKS_PATH, 'utf-8'))
    const patients = tasks.patients as Array<{
      name: string; dob: string; insurance: string; visit_count: number
      visits: Array<{ appt_time: string; appt_date: string; status: string }>
    }>

    // Load existing results for resume & dedup
    if (existsSync(OUTPUT_JSON)) {
      try {
        const existing = JSON.parse(readFileSync(OUTPUT_JSON, 'utf-8'))
        this.results = existing.records || []
        log(`Loaded ${this.results.length} existing records`)
      } catch {}
    }

    log(`Total: ${patients.length} patients, ${tasks.total_tasks} visits`)
    log(`Starting from patient #${startIdx + 1}\n`)

    let scraped = this.results.length
    let skipped = 0

    for (let pi = startIdx; pi < patients.length; pi++) {
      const p = patients[pi]
      log(`[${pi + 1}/${patients.length}] ${p.name} (${p.dob}) — ${p.visit_count} visits`)

      // Per-patient timeout: 30s base + 40s per visit
      const patientTimeout = 30000 + p.visit_count * 40000
      try {
        await withTimeout(this.processPatient(p, () => scraped, (n) => { scraped = n }, () => skipped, (n) => { skipped = n }), patientTimeout, `patient-${p.name}`)
      } catch (err) {
        log(`  ✗ patient timeout/error: ${err instanceof Error ? err.message : err}`)
        skipped += p.visit_count
        this.waitingRoomReady = false
        try { await this.closeVisit() } catch {}
        await sleep(2000)
      }

      // Auto-save after each patient
      if (this.results.length > 0) {
        this.saveJSON()
      }
    }

    log(`=== Done: ${scraped} scraped, ${skipped} skipped ===`)
  }

  private async processPatient(
    p: { name: string; dob: string; insurance: string; visit_count: number; visits: Array<{ appt_time: string; appt_date: string; status: string }> },
    getScraped: () => number,
    setScraped: (n: number) => void,
    getSkipped: () => number,
    setSkipped: (n: number) => void,
  ): Promise<void> {
    let scraped = getScraped()
    let skipped = getSkipped()

    let found = false
    try {
      found = await this.searchPatient(p.dob, p.name)
    } catch (err) {
      log(`  ✗ search failed: ${err instanceof Error ? err.message : err}`)
      this.waitingRoomReady = false
      setSkipped(skipped + p.visit_count)
      await sleep(2000)
      return
    }
    if (!found) { setSkipped(skipped + p.visit_count); return }

    let visits: Array<{ idx: number; visitId: string; apptDate: string; subject: string }> = []
    try {
      visits = await this.getVisitList()
    } catch (err) {
      log(`  ✗ visit list failed: ${err instanceof Error ? err.message : err}`)
      this.waitingRoomReady = false
      setSkipped(skipped + p.visit_count)
      await sleep(2000)
      return
    }
    log(`  ${visits.length} visits loaded`)

    // Build set of already-scraped visitIds for dedup
    const doneIds = new Set(this.results.map(r => r.visitId))

    for (let vi = 0; vi < visits.length; vi++) {
      const v = visits[vi]
      const visitStatus = p.visits[vi]?.status || 'unknown'

      if (doneIds.has(v.visitId)) {
        log(`  [${vi + 1}/${visits.length}] ${v.apptDate} (ID:${v.visitId}) — skip (already scraped)`)
        continue
      }

      log(`  [${vi + 1}/${visits.length}] ${v.apptDate} ${v.subject} (ID:${v.visitId}) [${visitStatus}]`)

      try {
        await withTimeout(this.openVisit(v.idx), 20000, 'openVisit')
        const { soap, icd, cpt } = await withTimeout(this.extractSOAPAndCodes(), 45000, 'extractSOAP')

        const hasSOAP = soap.subjective || soap.objective || soap.assessment || soap.plan
        const hasCodes = icd.length > 0 || cpt.length > 0

        this.results.push({
          name: p.name, dob: p.dob, insurance: p.insurance,
          subject: v.subject,
          apptTime: p.visits[vi]?.appt_time || v.apptDate,
          apptDate: p.visits[vi]?.appt_date || v.apptDate,
          visitId: v.visitId,
          status: visitStatus,
          icd, cpt, soap,
        })
        scraped++
        setScraped(scraped)

        if (hasSOAP || hasCodes) {
          log(`    ✓ ICD:${icd.length} CPT:${cpt.length} S:${soap.subjective.length} O:${soap.objective.length} A:${soap.assessment.length} P:${soap.plan.length}`)
        } else {
          log(`    ○ empty`)
        }

        log(`    [close]`)
        await withTimeout(this.closeVisit(), 15000, 'closeVisit')
        await sleep(1000)

      } catch (err) {
        log(`    ✗ ${err instanceof Error ? err.message : err}`)
        skipped++
        setSkipped(skipped)
        try { await this.closeVisit() } catch {}
        await sleep(2000)
      }

      // Auto-save every 5 records
      if (scraped > 0 && scraped % 5 === 0) {
        this.saveJSON()
        log(`  [auto-saved ${scraped} records]`)
      }
    }
  }

  // ── Pass 2: Download Intake Forms for patients with no billing ──

  async downloadIntakeForms(): Promise<void> {
    if (!existsSync(OUTPUT_JSON)) {
      console.error('No scraped data found. Run pass 1 first.')
      return
    }

    const data = JSON.parse(readFileSync(OUTPUT_JSON, 'utf-8'))
    const records = data.records as ScrapedVisit[]

    // Group by patient (name + insurance)
    const patientMap = new Map<string, ScrapedVisit[]>()
    for (const r of records) {
      const key = `${r.name}|${r.insurance}`
      const arr = patientMap.get(key) || []
      arr.push(r)
      patientMap.set(key, arr)
    }

    // Find patients with NO billing (no ICD/CPT across all visits)
    const noBillingPatients: Array<{ name: string; dob: string; insurance: string }> = []
    for (const [key, visits] of patientMap) {
      const hasBilling = visits.some(v => v.icd.length > 0 || v.cpt.length > 0)
      if (!hasBilling) {
        noBillingPatients.push({
          name: visits[0].name,
          dob: visits[0].dob,
          insurance: visits[0].insurance,
        })
      }
    }

    console.log(`\nPatients with no billing: ${noBillingPatients.length}`)
    console.log(`Patients with billing: ${patientMap.size - noBillingPatients.length}`)

    if (noBillingPatients.length === 0) {
      console.log('All patients have billing data. No intake forms needed.')
      return
    }

    // For each no-billing patient, navigate to Patient Home > Doc/Labs/Image
    for (let i = 0; i < noBillingPatients.length; i++) {
      const p = noBillingPatients[i]
      log(`[${i + 1}/${noBillingPatients.length}] ${p.name} (${p.dob}) — downloading intake form...`)

      try {
        const found = await this.searchPatient(p.dob, p.name)
        if (!found) continue

        // Get patient ID
        const patientId = await this.page.evaluate(() => {
          const frames = document.querySelectorAll('iframe')
          for (const f of frames) {
            const src = f.src || ''
            const m = src.match(/patientID=(\d+)/i)
            if (m) return m[1]
          }
          return ''
        })

        if (!patientId) {
          log(`  ✗ Could not find patient ID`)
          continue
        }

        // Open first visit to access Patient Home
        const visits = await this.getVisitList()
        if (visits.length === 0) continue

        await this.openVisit(visits[0].idx)

        // Click Patient Home
        const workarea = this.page.frameLocator('iframe[name="workarea0"]')
        try {
          await workarea.locator('td:has-text("Patient Home")').first().click({ timeout: 5000 })
          await sleep(5000)
        } catch {
          log(`  ✗ Could not open Patient Home`)
          await this.closeVisit()
          continue
        }

        // Look for AC INTAKE in Doc/Labs/Image
        const intakeInfo = await this.page.evaluate(() => {
          function searchFrames(doc: Document): string | null {
            const links = doc.querySelectorAll('a')
            for (const link of links) {
              const href = link.href || ''
              const text = link.innerText || ''
              if (href.includes('showPic') && (text.includes('INTAKE') || text.includes('intake'))) {
                const m = href.match(/showPic\((\d+)\)/)
                if (m) return m[1]
              }
            }
            // Also search in table cells for AC INTAKE with nearby showPic links
            const cells = doc.querySelectorAll('td')
            for (const cell of cells) {
              if ((cell as HTMLElement).innerText?.includes('AC INTAKE')) {
                const parent = cell.closest('table')
                if (parent) {
                  const pLinks = parent.querySelectorAll('a[href*="showPic"]')
                  for (const pl of pLinks) {
                    const m = (pl as HTMLAnchorElement).href.match(/showPic\((\d+)\)/)
                    if (m) return m[1]
                  }
                }
              }
            }
            const frames = doc.querySelectorAll('iframe, frame')
            for (const f of frames) {
              try {
                const fd = (f as HTMLIFrameElement).contentDocument
                if (fd) {
                  const r = searchFrames(fd)
                  if (r) return r
                }
              } catch {}
            }
            return null
          }
          return searchFrames(document)
        })

        if (intakeInfo) {
          // Download PDF
          const safeName = p.name.replace(/[^a-zA-Z0-9]/g, '_')
          const pdfPath = join(INTAKE_DIR, `${safeName}_${patientId}_intake.pdf`)
          const pdfUrl = `https://web153.b.mdland.net/eClinic/show_pdf.aspx?mode=4&ID=${intakeInfo}&patientID=${patientId}&rotateAng=0`

          const base64 = await this.page.evaluate(async (url) => {
            const resp = await fetch(url)
            if (!resp.ok) return null
            const blob = await resp.blob()
            const reader = new FileReader()
            return new Promise<string | null>((resolve) => {
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = () => resolve(null)
              reader.readAsDataURL(blob)
            })
          }, pdfUrl)

          if (base64) {
            const data = base64.split(',')[1]
            if (data) {
              writeFileSync(pdfPath, Buffer.from(data, 'base64'))
              log(`  ✓ Intake form saved: ${pdfPath}`)
            }
          } else {
            log(`  ✗ Failed to download intake form`)
          }
        } else {
          log(`  ○ No intake form found`)
        }

        await this.closeVisit()
      } catch (err) {
        log(`  ✗ ${err instanceof Error ? err.message : err}`)
        try { await this.closeVisit() } catch {}
        this.waitingRoomReady = false
      }
    }
  }

  saveJSON(): void {
    writeFileSync(OUTPUT_JSON, JSON.stringify({
      scrapedAt: new Date().toISOString(),
      totalRecords: this.results.length,
      records: this.results,
    }, null, 2), 'utf-8')
    log(`JSON → ${OUTPUT_JSON} (${this.results.length})`)
  }

  async saveExcel(): Promise<void> {
    const header = ['Name', 'DOB', 'Insurance', 'Subject', 'Appt Date', 'Appt Time', 'Visit ID',
      'Status', 'ICD Codes', 'CPT Codes', 'Subjective', 'Objective', 'Assessment', 'Plan']
    const rows = this.results.map(r => [
      r.name, r.dob, r.insurance, r.subject, r.apptDate, r.apptTime, r.visitId,
      r.status, r.icd.join('; '), r.cpt.join('; '),
      r.soap.subjective.replace(/[\t\n]/g, ' '),
      r.soap.objective.replace(/[\t\n]/g, ' '),
      r.soap.assessment.replace(/[\t\n]/g, ' '),
      r.soap.plan.replace(/[\t\n]/g, ' '),
    ])
    const tsv = [header, ...rows].map(r => r.join('\t')).join('\n')
    const tsvPath = OUTPUT_EXCEL.replace('.xlsx', '.tsv')
    writeFileSync(tsvPath, '\uFEFF' + tsv, 'utf-8')
    console.log(`TSV → ${tsvPath}`)

    try {
      const ExcelJS = require('exceljs')
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('SOAP Data')
      ws.addRow(header)
      for (const row of rows) ws.addRow(row)
      ws.getRow(1).font = { bold: true }
      ws.columns.forEach((col: any) => { col.width = 20 })
      await wb.xlsx.writeFile(OUTPUT_EXCEL)
      console.log(`XLSX → ${OUTPUT_EXCEL}`)
    } catch { console.log('(exceljs not installed, TSV only)') }
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close()
  }
}

async function main() {
  const { headless, start, intakeOnly } = parseArgs()
  const scraper = new MDLandScraper(headless)
  await scraper.init()

  if (!(await scraper.loginFresh())) { await scraper.close(); process.exit(1) }

  try {
    if (intakeOnly) {
      await scraper.downloadIntakeForms()
    } else {
      await scraper.scrapeAll(start)
      scraper.saveJSON()
      await scraper.saveExcel()
    }
  } catch (err) {
    console.error('Fatal:', err)
    scraper.saveJSON()
    await scraper.saveExcel()
  } finally {
    await scraper.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
