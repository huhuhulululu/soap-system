/**
 * MDLand Playwright Automation PoC
 *
 * 使用 Playwright + Cookie 复用方案自动化 MDLand SOAP 填写
 *
 * 核心差异 vs Tampermonkey:
 *   - Tampermonkey: 在浏览器内运行, 直接访问 window/DOM/JS 函数
 *   - Playwright: 外部进程控制, 通过 page.evaluate() 访问 JS, frameLocator 操作 iframe
 *
 * 优势:
 *   - 无需 Tampermonkey 扩展, 适合服务器端无头运行
 *   - 可与 CI/CD 或定时任务集成
 *   - 更好的错误恢复和重试机制
 *   - 可截图/录屏用于审计
 *
 * 使用:
 *   npx tsx scripts/playwright/mdland-automation.ts <batchId> [--headless] [--screenshot]
 */

import { chromium, type Page, type BrowserContext, type FrameLocator } from 'playwright';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

// ============================================
// 类型定义
// ============================================

interface VisitData {
  readonly index: number;
  readonly dos: number;
  readonly noteType: string;
  readonly txNumber?: number;
  readonly bodyPart: string;
  readonly laterality?: string;
  readonly icdCodes: ReadonlyArray<{ readonly code: string; readonly name: string }>;
  readonly cptCodes: ReadonlyArray<{
    readonly code: string;
    readonly name: string;
    readonly units: number;
  }>;
  readonly generated: {
    readonly soap: {
      readonly subjective: string;
      readonly objective: string;
      readonly assessment: string;
      readonly plan: string;
    };
    readonly html: {
      readonly subjective: string;
      readonly objective: string;
      readonly assessment: string;
      readonly plan: string;
    };
  };
  readonly status: string;
}

interface PatientData {
  readonly name: string;
  readonly dob: string;
  readonly age: number;
  readonly gender: string;
  readonly insurance: string;
  readonly visits: ReadonlyArray<VisitData>;
}

interface BatchData {
  readonly batchId: string;
  readonly patients: ReadonlyArray<PatientData>;
  readonly summary: {
    readonly totalPatients: number;
    readonly totalVisits: number;
  };
}

interface AutomationOptions {
  readonly headless: boolean;
  readonly screenshot: boolean;
  readonly screenshotDir: string;
  readonly apiBase: string;
  readonly storageStatePath: string;
  readonly slowMo: number;
  readonly timeout: number;
}

interface VisitResult {
  readonly patient: string;
  readonly visitIndex: number;
  readonly noteType: string;
  readonly success: boolean;
  readonly error?: string;
  readonly duration: number;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_OPTIONS: AutomationOptions = {
  headless: false,
  screenshot: false,
  screenshotDir: join(dirname(dirname(__dirname)), 'data', 'screenshots'),
  apiBase: 'http://150.136.150.184:3001',
  storageStatePath: join(dirname(dirname(__dirname)), 'data', 'mdland-storage-state.json'),
  slowMo: 100,
  timeout: 30000
};

// ============================================
// MDLand 页面选择器
// ============================================

const SELECTORS = {
  // 主框架
  WORKAREA0: 'iframe[name="workarea0"]',

  // 等待室
  WAITING_ROOM_BTN: 'td[title="Waiting Room"]',
  WL_DIV: '#WL',
  ONE_PATIENT_RADIO: 'input[type="radio"][name="listAllPatient"]',

  // 搜索
  SEARCH_FRAME: '#frm_searchframe',
  SEARCH_INPUT: '#searchStr',
  SEARCH_BUTTON: '#btnSearch',
  SELECTOR_DIV: '#selectorDiv',

  // Visit
  CLAIM_ROW: 'tr[id^="trt"]',

  // OfficeVisit 导航菜单
  ICD_MENU: '#a_EMR_icdcpt',
  PTNOTE_MENU: '#a_EMR_ptnote',
  CHECKOUT_MENU: '#a_EMR_checkout',

  // ICD/CPT iframe
  DIAGNOSE_FRAME: '#diagnose',
  ICD_LIST: 'select[name="list"]',
  CPT_LIST: 'select[name="list_cpt"]',

  // SOAP iframe
  PTNOTE_FRAME: '#ptnote',

  // Checkout iframe
  CHECKOUT_FRAME: '#checkout',
  BILLING_SPAN: '#spanPassToBill'
} as const;

// ============================================
// MDLand Playwright 自动化器
// ============================================

class MDLandAutomation {
  private readonly options: AutomationOptions;
  private page!: Page;
  private context!: BrowserContext;

  constructor(options: Partial<AutomationOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ==============================
  // 初始化
  // ==============================

  async init(): Promise<void> {
    if (!existsSync(this.options.storageStatePath)) {
      throw new Error(
        `Storage state not found: ${this.options.storageStatePath}\n` +
        'Run extract-cookies.ts first to capture MDLand session.'
      );
    }

    console.log('Launching browser...');

    const browser = await chromium.launch({
      headless: this.options.headless,
      slowMo: this.options.slowMo
    });

    this.context = await browser.newContext({
      storageState: this.options.storageStatePath,
      viewport: { width: 1400, height: 900 }
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.options.timeout);

    // tsx injects __name() calls that don't exist in browser context
    await this.page.addInitScript(() => {
      (window as any).__name = (fn: any) => fn;
    });

    // 拦截所有 dialog (confirm/alert)
    this.page.on('dialog', async dialog => {
      console.log(`  Dialog: ${dialog.type()} - ${dialog.message()}`);
      await dialog.accept();
    });
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
  }

  // ==============================
  // Session 验证
  // ==============================

  async validateSession(): Promise<boolean> {
    console.log('Validating MDLand session...');

    // 导航到 MDLand 主页（需要认证的页面）
    await this.page.goto('https://web153.b.mdland.net/eClinic/clinic_main.aspx', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    // 等待页面加载
    await this.page.waitForTimeout(3000);

    // 检查是否在登录页（session 过期）
    const isLoginPage = await this.page.evaluate(() => {
      const loginForm = document.querySelector('input[name="password"], #loginForm, form[action*="login"]');
      return loginForm !== null;
    });

    if (isLoginPage) {
      console.log('Session expired - redirected to login page');
      return false;
    }

    // 检查 workarea0 存在
    const hasWorkarea = await this.page.evaluate(() => {
      return document.getElementById('workarea0') !== null;
    });

    if (hasWorkarea) {
      console.log('Session valid - workarea0 found');
      return true;
    }

    // 可能需要等待更长时间
    try {
      await this.page.waitForSelector(SELECTORS.WORKAREA0, { timeout: 10000 });
      console.log('Session valid');
      return true;
    } catch {
      const finalUrl = this.page.url();
      const title = await this.page.title().catch(() => '');
      console.log(`Session invalid - workarea0 not found. URL: ${finalUrl}, Title: ${title}`);
      await this.page.screenshot({ path: join(dirname(dirname(__dirname)), 'data', 'screenshots', `session-fail-${Date.now()}.png`) }).catch(() => {});
      return false;
    }
  }

  // ==============================
  // 导航操作
  // ==============================

  /**
   * 点击 Waiting Room
   */
  async clickWaitingRoom(): Promise<void> {
    console.log('  Clicking Waiting Room...');

    // Waiting Room 按钮可能在主文档或任何 frame 中
    // 先尝试主文档
    const btn = this.page.locator(SELECTORS.WAITING_ROOM_BTN);
    const btnInFrame = this.page
      .frameLocator(SELECTORS.WORKAREA0)
      .locator(SELECTORS.WAITING_ROOM_BTN);

    const mainExists = await btn.count();
    if (mainExists > 0) {
      await btn.click();
    } else {
      await btnInFrame.click();
    }

    // 等待 WL div 可见
    await this.page.waitForFunction(() => {
      const wl = document.getElementById('WL');
      return wl && wl.style.visibility !== 'hidden';
    }, { timeout: 10000 });

    await this.page.waitForTimeout(1000);
    console.log('  Waiting Room opened');
  }

  /**
   * 选择 "One Patient" 模式
   */
  async clickOnePatient(): Promise<void> {
    console.log('  Selecting One Patient mode...');

    // 在所有 frames 中搜索 radio
    const clicked = await this.page.evaluate(() => {
      const allFrames = [document];
      const iframes = document.querySelectorAll('iframe, frame');
      iframes.forEach(f => {
        try {
          const fd = (f as HTMLIFrameElement).contentDocument;
          if (fd) allFrames.push(fd);
        } catch { /* cross-origin */ }
      });

      for (const doc of allFrames) {
        const radios = Array.from(doc.querySelectorAll('input[type="radio"][name="listAllPatient"]'));
        for (const radio of radios) {
          const parent = (radio as HTMLElement).parentElement;
          if (parent?.textContent?.includes('One Patient')) {
            (radio as HTMLInputElement).click();
            return true;
          }
        }
      }
      return false;
    });

    if (!clicked) {
      throw new Error('One Patient radio not found');
    }

    await this.page.waitForTimeout(500);
  }

  /**
   * 搜索患者 (by DOB)
   */
  async searchPatient(dob: string): Promise<void> {
    console.log(`  Searching patient: ${dob}...`);

    // 搜索框在 searchframe iframe 中
    const searchFrame = this.findSearchFrame();

    // 清空并输入 DOB
    const input = searchFrame.locator(SELECTORS.SEARCH_INPUT);
    await input.fill('');
    await input.fill(dob);
    await this.page.waitForTimeout(200);

    // 点击搜索
    const goBtn = searchFrame.locator(SELECTORS.SEARCH_BUTTON);
    await goBtn.click();

    // 等待搜索结果
    await searchFrame.locator(`${SELECTORS.SELECTOR_DIV} tr[onclick], ${SELECTORS.SELECTOR_DIV} tr[ondblclick]`).first().waitFor({
      timeout: 10000
    });

    console.log('  Search results shown');
    await this.page.waitForTimeout(500);
  }

  /**
   * 选择搜索结果中的患者
   */
  async selectPatient(name: string, dob: string): Promise<void> {
    console.log(`  Selecting patient: ${name}...`);

    const searchFrame = this.findSearchFrame();

    // 在搜索结果中找到匹配的行
    await searchFrame.locator(SELECTORS.SELECTOR_DIV).evaluate(
      (selectorDiv, { patientName, patientDob }) => {
        const rows = selectorDiv.querySelectorAll('tr[onclick], tr[ondblclick]');
        for (let ri = 0; ri < rows.length; ri++) {
          const row = rows[ri] as HTMLElement;
          const text = (row.textContent || '').toUpperCase();
          if (text.includes(patientDob)) {
            const nameParts = patientName.toUpperCase().split(/[\s,]+/).filter((p: string) => p.length > 1);
            if (nameParts.every((p: string) => text.includes(p))) {
              const link = row.querySelector('a');
              if (link) {
                (link as HTMLAnchorElement).click();
              } else {
                (row as HTMLElement).click();
              }
              return;
            }
          }
        }
        throw new Error(`Patient not found: ${patientName} (${patientDob})`);
      },
      { patientName: name, patientDob: dob }
    );

    await this.page.waitForTimeout(2000);
    console.log(`  Patient selected: ${name}`);
  }

  /**
   * 按 Appt Time 排序（升序）
   */
  async sortByApptTime(): Promise<void> {
    console.log('  Sorting by Appt Time (ascending)...');

    const clickApptTime = async () => {
      await this.page.evaluate(() => {
        const search = (doc: Document): boolean => {
          const tds = doc.querySelectorAll('td[onclick]');
          for (const td of tds) {
            if (td.textContent?.includes('Appt Time')) {
              (td as HTMLElement).click();
              return true;
            }
          }
          for (const f of Array.from(doc.querySelectorAll('iframe, frame'))) {
            try {
              const fd = (f as HTMLIFrameElement).contentDocument;
              if (fd && search(fd)) return true;
            } catch { /* cross-origin */ }
          }
          return false;
        };
        return search(document);
      });
      await this.page.waitForTimeout(1500);
    };

    // Click twice: first click = descending, second click = ascending
    await clickApptTime();
    await clickApptTime();

    console.log('  Sorted by Appt Time (ascending)');
  }

  /**
   * 打开第 N 个 visit
   */
  async openVisit(visitIndex: number): Promise<void> {
    console.log(`  Opening visit #${visitIndex}...`);

    // 在所有 frames 中查找 visit 行
    const opened = await this.page.evaluate((index) => {
      const searchFrames = (doc: Document): boolean => {
        const rows = doc.querySelectorAll('tr[id^="trt"]');
        if (rows.length > 0) {
          const target = rows[index - 1];
          if (!target) return false;

          const link = target.querySelector('a[href*="moveInMe"]');
          if (link) {
            (link as HTMLAnchorElement).click();
            return true;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const win = doc.defaultView as any;
          if (win && win.moveInMe) {
            win.moveInMe(index);
            return true;
          }

          (target as HTMLElement).click();
          return true;
        }

        // 递归搜索子 frames
        const iframes = Array.from(doc.querySelectorAll('iframe, frame'));
        for (const iframe of iframes) {
          try {
            const fd = (iframe as HTMLIFrameElement).contentDocument;
            if (fd && searchFrames(fd)) return true;
          } catch { /* cross-origin */ }
        }
        return false;
      }

      return searchFrames(document);
    }, visitIndex);

    if (!opened) {
      throw new Error(`Visit #${visitIndex} not found`);
    }

    // 等待 workarea0 加载 ov_doctor_spec
    await this.page.waitForFunction(() => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement | null;
      if (!wa0?.contentDocument) return false;
      const url = wa0.contentDocument.location?.href || '';
      return url.includes('ov_doctor_spec');
    }, { timeout: 15000 });

    await this.page.waitForTimeout(2000);
    console.log(`  Visit #${visitIndex} opened`);
  }

  // ==============================
  // ICD/CPT 操作
  // ==============================

  /**
   * 导航到 ICD/CPT 编辑页
   */
  async navigateToICD(): Promise<void> {
    console.log('  Navigating to ICD/CPT...');

    // OfficeVisit iframe 在 workarea0 内
    await this.page.evaluate(() => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const ovFrame = wa0?.contentDocument?.getElementById('OfficeVisit') as HTMLIFrameElement;
      const icdBtn = ovFrame?.contentDocument?.getElementById('a_EMR_icdcpt');
      if (!icdBtn) throw new Error('ICD/CPT menu not found');
      icdBtn.click();
    });

    // 等待 diagnose iframe 加载 ov_icdcpt
    await this.page.waitForFunction(() => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const diag = wa0?.contentDocument?.getElementById('diagnose') as HTMLIFrameElement;
      if (!diag?.contentDocument) return false;
      const url = diag.contentDocument.location?.href || '';
      return url.includes('ov_icdcpt');
    }, { timeout: 15000 });

    await this.page.waitForTimeout(1000);
    console.log('  ICD/CPT page loaded');
  }

  /**
   * 添加 ICD codes
   */
  async addICDCodes(icdCodes: ReadonlyArray<{ readonly code: string; readonly name: string }>): Promise<void> {
    console.log(`  Adding ${icdCodes.length} ICD codes...`);

    await this.page.evaluate((codes) => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const diag = wa0?.contentDocument?.getElementById('diagnose') as HTMLIFrameElement;
      const diagDoc = diag?.contentDocument;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diagWin: any = diag?.contentWindow;

      if (!diagDoc || !diagWin) throw new Error('Diagnose iframe not accessible');

      for (const icd of codes) {
        const listEl = diagDoc.querySelector('select[name="list"]') as HTMLSelectElement;
        let found = false;

        if (listEl) {
          for (let i = 0; i < listEl.options.length; i++) {
            if (listEl.options[i].value === icd.code) {
              listEl.selectedIndex = i;
              if (listEl.ondblclick) {
                listEl.ondblclick(new MouseEvent('dblclick'));
              } else {
                listEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
              }
              found = true;
              break;
            }
          }
        }

        if (!found && typeof diagWin.addSelectionD === 'function') {
          diagWin.addSelectionD(icd.name || icd.code, icd.code);
        } else if (!found) {
          throw new Error(`Cannot add ICD ${icd.code}: addSelectionD not available`);
        }
      }
    }, icdCodes as Array<{ code: string; name: string }>);

    await this.page.waitForTimeout(500);
    console.log(`  Added ${icdCodes.length} ICD codes`);
  }

  /**
   * 添加 CPT codes
   */
  async addCPTCodes(cptCodes: ReadonlyArray<{
    readonly code: string;
    readonly name: string;
    readonly units: number;
  }>): Promise<void> {
    console.log(`  Adding ${cptCodes.length} CPT codes...`);

    await this.page.evaluate((codes) => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const diag = wa0?.contentDocument?.getElementById('diagnose') as HTMLIFrameElement;
      const diagDoc = diag?.contentDocument;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diagWin: any = diag?.contentWindow;

      if (!diagDoc || !diagWin) throw new Error('Diagnose iframe not accessible');

      for (const cpt of codes) {
        const listCPT = diagDoc.querySelector('select[name="list_cpt"]') as HTMLSelectElement;
        let found = false;

        if (listCPT) {
          for (let i = 0; i < listCPT.options.length; i++) {
            const optValue = listCPT.options[i].value;
            if (optValue === cpt.code || optValue.startsWith(cpt.code)) {
              listCPT.selectedIndex = i;
              if (listCPT.ondblclick) {
                listCPT.ondblclick(new MouseEvent('dblclick'));
              } else {
                listCPT.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
              }
              found = true;
              break;
            }
          }
        }

        if (!found && typeof diagWin.addSelectionD_cpt === 'function') {
          const name = cpt.name || cpt.code;
          diagWin.addSelectionD_cpt(name, name, cpt.code);
        } else if (!found) {
          throw new Error(`Cannot add CPT ${cpt.code}: addSelectionD_cpt not available`);
        }
      }

      // 设置 Units 和 LinkICD
      const unitFields = diagDoc.querySelectorAll('input[name="Units"]');
      const linkFields = diagDoc.querySelectorAll('input[name="LinkICD"]');
      const icdCount = diagDoc.querySelectorAll('input[name="diag_code_h"]').length;
      const linkICD = Array.from({ length: icdCount }, (_, i) => String(i + 1)).join(',');

      for (let i = 0; i < codes.length; i++) {
        const fieldIdx = unitFields.length - codes.length + i;
        if (fieldIdx < 0 || fieldIdx >= unitFields.length) continue;

        const unitField = unitFields[fieldIdx] as HTMLInputElement;
        unitField.value = String(codes[i].units || 1);
        unitField.dispatchEvent(new Event('change', { bubbles: true }));

        const linkField = linkFields[fieldIdx] as HTMLInputElement;
        if (linkField) {
          linkField.value = linkICD;
          linkField.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // 标记修改
      const modFields = diagDoc.querySelectorAll('input[name="link_select_modified"]');
      modFields.forEach(f => { (f as HTMLInputElement).value = '1'; });
    }, cptCodes as Array<{ code: string; name: string; units: number }>);

    await this.page.waitForTimeout(500);
    console.log(`  Added ${cptCodes.length} CPT codes`);
  }

  /**
   * 保存 ICD/CPT (letsGo)
   */
  async saveDiagnose(): Promise<void> {
    console.log('  Saving ICD/CPT...');

    await this.page.evaluate(() => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const diag = wa0?.contentDocument?.getElementById('diagnose') as HTMLIFrameElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diagWin: any = diag?.contentWindow;

      if (typeof diagWin?.letsGo === 'function') {
        diagWin.letsGo(2);
      } else {
        throw new Error('letsGo not available');
      }
    });

    // 等待页面重载
    await this.page.waitForTimeout(2000);
    await this.page.waitForFunction(() => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const diag = wa0?.contentDocument?.getElementById('diagnose') as HTMLIFrameElement;
      if (!diag?.contentDocument) return false;
      const url = diag.contentDocument.location?.href || '';
      return url.includes('ov_icdcpt');
    }, { timeout: 15000 });

    console.log('  ICD/CPT saved');
  }

  // ==============================
  // SOAP 操作
  // ==============================

  /**
   * 导航到 PT Note
   */
  async navigateToPTNote(): Promise<void> {
    console.log('  Navigating to PT Note...');

    await this.page.evaluate(() => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const ovFrame = wa0?.contentDocument?.getElementById('OfficeVisit') as HTMLIFrameElement;
      const ptBtn = ovFrame?.contentDocument?.getElementById('a_EMR_ptnote');
      if (!ptBtn) throw new Error('PT Note menu not found');
      ptBtn.click();
    });

    // 等待 ptnote iframe 加载 + TinyMCE 初始化
    await this.page.waitForFunction(() => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const pt = wa0?.contentDocument?.getElementById('ptnote') as HTMLIFrameElement;
      if (!pt?.contentDocument) return false;
      const url = pt.contentDocument.location?.href || '';
      if (!url.includes('ov_ptnote')) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ptWin: any = pt.contentWindow;
      const tinyMCE = ptWin?.tinyMCE;
      return typeof tinyMCE?.getInstanceById === 'function';
    }, { timeout: 20000 });

    await this.page.waitForTimeout(1000);
    console.log('  PT Note loaded with TinyMCE');
  }

  /**
   * 填充 SOAP 四个部分
   */
  async fillSOAP(soap: VisitData['generated']['soap'], html?: VisitData['generated']['html']): Promise<void> {
    console.log('  Filling SOAP sections...');

    await this.page.evaluate(({ soapData, htmlData }) => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const pt = wa0?.contentDocument?.getElementById('ptnote') as HTMLIFrameElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ptWin: any = pt?.contentWindow;
      const ptDoc = pt?.contentDocument;

      if (!ptWin || !ptDoc) throw new Error('PT Note window not accessible');

      const tinyMCE = ptWin.tinyMCE;
      if (!tinyMCE) throw new Error('TinyMCE not loaded');

      const textToHTML = (text: string): string => {
        if (!text) return '';
        return text.split('\n').filter(l => l.trim()).map(l => {
          const e = l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<p>${e}</p>`;
        }).join('');
      };

      const sections = [
        { id: 'SOAPtext0', content: htmlData?.subjective || textToHTML(soapData.subjective) },
        { id: 'SOAPtext1', content: htmlData?.objective || textToHTML(soapData.objective) },
        { id: 'SOAPtext2', content: htmlData?.assessment || textToHTML(soapData.assessment) },
        { id: 'SOAPtext3', content: htmlData?.plan || textToHTML(soapData.plan) },
      ];

      for (const section of sections) {
        const editor = tinyMCE.getInstanceById(section.id);
        if (editor) {
          // Focus editor, set content, mark dirty
          editor.focus();
          editor.setContent(section.content);
          editor.isNotDirty = false;
          if (editor.nodeChanged) editor.nodeChanged();
        }
        const textarea = ptDoc.getElementById(section.id) as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.value = section.content;
        }
      }

      // Sync all editors to textareas
      if (tinyMCE.triggerSave) tinyMCE.triggerSave();

      // Mark page as modified so saveIt() proceeds
      ptWin.modified = 1;
      if (ptWin.isAjaxSave !== undefined) ptWin.isAjaxSave = '1';
    }, { soapData: soap, htmlData: html || null });

    console.log('  SOAP filled');
  }

  async saveSOAP(): Promise<void> {
    console.log('  Saving SOAP...');

    // Ensure TinyMCE content is synced, then click Save button
    await this.page.evaluate(() => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const wa0Doc = wa0?.contentDocument;
      if (!wa0Doc) throw new Error('workarea0 not accessible');

      // Sync TinyMCE in ptnote
      const pt = wa0Doc.getElementById('ptnote') as HTMLIFrameElement;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ptWin: any = pt?.contentWindow;
      if (ptWin?.tinyMCE?.triggerSave) ptWin.tinyMCE.triggerSave();

      // Search all frames for #SavePage
      const findSave = (doc: Document): { el: HTMLElement; win: Window } | null => {
        const el = doc.getElementById('SavePage') as HTMLElement;
        if (el) return { el, win: doc.defaultView || window };
        for (const f of Array.from(doc.querySelectorAll('iframe, frame'))) {
          try {
            const fd = (f as HTMLIFrameElement).contentDocument;
            if (fd) { const r = findSave(fd); if (r) return r; }
          } catch { /* cross-origin */ }
        }
        return null;
      };

      const save = findSave(document);
      if (!save) throw new Error('SavePage not found in any frame');

      const events = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
      for (const eventType of events) {
        save.el.dispatchEvent(new MouseEvent(eventType, {
          bubbles: true, cancelable: true, view: save.win
        }));
      }
    });

    // Wait for save to complete (page may reload or show confirmation)
    await this.page.waitForTimeout(3000);

    // Verify save by checking if ptnote iframe is still accessible
    await this.page.waitForFunction(() => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const pt = wa0?.contentDocument?.getElementById('ptnote') as HTMLIFrameElement;
      return pt?.contentDocument?.readyState === 'complete';
    }, { timeout: 15000 });

    console.log('  SOAP saved');
  }

  // ==============================
  // Checkout
  // ==============================

  async navigateToCheckout(): Promise<void> {
    console.log('  Navigating to Checkout...');

    await this.page.evaluate(() => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const ovFrame = wa0?.contentDocument?.getElementById('OfficeVisit') as HTMLIFrameElement;
      const btn = ovFrame?.contentDocument?.getElementById('a_EMR_checkout');
      if (!btn) throw new Error('Checkout menu not found');
      btn.click();
    });

    await this.page.waitForFunction(() => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      const co = wa0?.contentDocument?.getElementById('checkout') as HTMLIFrameElement;
      if (!co?.contentDocument) return false;
      const url = co.contentDocument.location?.href || '';
      return url.includes('checkout');
    }, { timeout: 15000 });

    await this.page.waitForTimeout(1000);
    console.log('  Checkout page loaded');
  }

  async generateBilling(): Promise<void> {
    console.log('  Generating billing...');

    // Click the Generate Billing button using humanClick pattern (matching BILL.js)
    await this.page.evaluate(() => {
      // Search all nested iframes for the billing button
      const findInDocs = (selector: string): { el: HTMLElement; win: Window } | null => {
        const search = (doc: Document): { el: HTMLElement; win: Window } | null => {
          const el = doc.querySelector(selector) as HTMLElement;
          if (el) return { el, win: doc.defaultView || window };
          for (const f of Array.from(doc.querySelectorAll('iframe, frame'))) {
            try {
              const fd = (f as HTMLIFrameElement).contentDocument;
              if (fd) { const r = search(fd); if (r) return r; }
            } catch { /* cross-origin */ }
          }
          return null;
        };
        return search(document);
      };

      const btn = findInDocs('#btn_generatebill') || findInDocs('[onclick*="letsGo(2)"]');
      if (!btn) {
        // Fallback: call checkOutOV directly
        const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
        const co = wa0?.contentDocument?.getElementById('checkout') as HTMLIFrameElement;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coWin: any = co?.contentWindow;
        if (typeof coWin?.checkOutOV === 'function') {
          coWin.checkOutOV(2);
          return;
        }
        throw new Error('Generate Billing button not found');
      }

      // humanClick: full mouse event chain
      const events = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
      for (const eventType of events) {
        btn.el.dispatchEvent(new MouseEvent(eventType, {
          bubbles: true, cancelable: true, view: btn.win
        }));
      }
    });

    // Wait for billing completion
    await this.page.waitForTimeout(3000);
    console.log('  Billing generated');
  }

  // ==============================
  // Close Visit
  // ==============================

  async closeVisit(): Promise<void> {
    console.log('  Closing visit...');

    // After billing, visit may already be auto-closed
    const alreadyClosed = await this.page.evaluate(() => {
      const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
      if (!wa0?.contentDocument) return true;
      const url = wa0.contentDocument.location?.href || '';
      if (url.includes('emptyarea')) return true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wa0Win: any = wa0.contentWindow;
      if (typeof wa0Win?.closeMe === 'function') {
        wa0Win.closeMe(true);
        return false;
      }
      return true; // no closeMe = treat as already closed
    });

    if (!alreadyClosed) {
      await this.page.waitForFunction(() => {
        const wa0 = document.getElementById('workarea0') as HTMLIFrameElement;
        if (!wa0?.contentDocument) return false;
        const url = wa0.contentDocument.location?.href || '';
        return url.includes('emptyarea');
      }, { timeout: 10000 }).catch(() => {});
    }

    await this.page.waitForTimeout(1000);
    console.log('  Visit closed');
  }

  // ==============================
  // 截图
  // ==============================

  async takeScreenshot(label: string): Promise<void> {
    if (!this.options.screenshot) return;

    const { mkdirSync, existsSync } = await import('fs');
    if (!existsSync(this.options.screenshotDir)) {
      mkdirSync(this.options.screenshotDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = join(this.options.screenshotDir, `${label}-${timestamp}.png`);
    await this.page.screenshot({ path, fullPage: true });
    console.log(`  Screenshot: ${path}`);
  }

  // ==============================
  // 辅助
  // ==============================

  private findSearchFrame(): FrameLocator {
    // 搜索框在 searchframe iframe 中, 可能嵌套
    return this.page.frameLocator(SELECTORS.SEARCH_FRAME);
  }

  // ==============================
  // 主执行流程
  // ==============================

  /**
   * 处理单个 visit
   */
  async processVisit(patient: PatientData, visit: VisitData): Promise<VisitResult> {
    const start = Date.now();
    const label = `${patient.name} Visit#${visit.dos} (${visit.noteType})`;
    console.log(`\n=== Processing: ${label} ===`);

    try {
      // Step 1: ICD/CPT
      await this.navigateToICD();
      await this.addICDCodes(visit.icdCodes);
      await this.addCPTCodes(visit.cptCodes);
      await this.saveDiagnose();
      await this.takeScreenshot(`icd-saved-${patient.name}-${visit.dos}`);

      // Step 2: SOAP
      await this.navigateToPTNote();
      await this.fillSOAP(visit.generated.soap, visit.generated.html);
      await this.saveSOAP();
      await this.takeScreenshot(`soap-saved-${patient.name}-${visit.dos}`);

      // Step 3: Checkout
      await this.navigateToCheckout();
      await this.generateBilling();
      await this.takeScreenshot(`billing-done-${patient.name}-${visit.dos}`);

      // Step 4: Close
      await this.closeVisit();

      const duration = Date.now() - start;
      console.log(`=== Completed: ${label} (${duration}ms) ===`);

      return {
        patient: patient.name,
        visitIndex: visit.dos,
        noteType: visit.noteType,
        success: true,
        duration
      };
    } catch (err) {
      const duration = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`=== Failed: ${label} — ${errorMsg} ===`);

      await this.takeScreenshot(`error-${patient.name}-${visit.dos}`);

      // 尝试关闭 visit
      try {
        await this.closeVisit();
      } catch { /* ignore */ }

      return {
        patient: patient.name,
        visitIndex: visit.dos,
        noteType: visit.noteType,
        success: false,
        error: errorMsg,
        duration
      };
    }
  }

  /**
   * 处理一个患者的所有 visits
   */
  async processPatient(patient: PatientData, isFirst: boolean): Promise<ReadonlyArray<VisitResult>> {
    console.log(`\nProcessing patient: ${patient.name} (${patient.visits.length} visits)`);

    if (isFirst) {
      await this.clickWaitingRoom();
    }

    await this.clickOnePatient();
    await this.searchPatient(patient.dob);
    await this.selectPatient(patient.name, patient.dob);
    await this.sortByApptTime();

    const results: VisitResult[] = [];

    for (let i = 0; i < patient.visits.length; i++) {
      const visit = patient.visits[i];
      if (visit.status !== 'done') continue;

      await this.openVisit(visit.dos);
      const result = await this.processVisit(patient, visit);
      results.push(result);

      // 同患者多 visit: 关闭后回到 Waiting Room 重新搜索
      if (i < patient.visits.length - 1 && result.success) {
        await this.clickWaitingRoom();
        await this.clickOnePatient();
        await this.searchPatient(patient.dob);
        await this.selectPatient(patient.name, patient.dob);
        await this.sortByApptTime();
      }
    }

    return results;
  }

  /**
   * 处理完整批次
   */
  async processBatch(batchData: BatchData): Promise<ReadonlyArray<VisitResult>> {
    console.log(`\n========================================`);
    console.log(`Batch: ${batchData.batchId}`);
    console.log(`Patients: ${batchData.patients.length}`);
    console.log(`Visits: ${batchData.summary.totalVisits}`);
    console.log(`========================================\n`);

    const allResults: VisitResult[] = [];

    for (let i = 0; i < batchData.patients.length; i++) {
      const patientResults = await this.processPatient(batchData.patients[i], i === 0);
      allResults.push(...patientResults);
    }

    // 打印总结
    const succeeded = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;
    const totalTime = allResults.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\n========================================`);
    console.log(`BATCH COMPLETE`);
    console.log(`  Succeeded: ${succeeded}`);
    console.log(`  Failed:    ${failed}`);
    console.log(`  Total:     ${allResults.length}`);
    console.log(`  Time:      ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`========================================\n`);

    if (failed > 0) {
      console.log('Failed visits:');
      allResults
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.patient} Visit#${r.visitIndex}: ${r.error}`));
    }

    return allResults;
  }
}

// ============================================
// API 加载
// ============================================

async function loadBatchFromAPI(apiBase: string, batchId: string): Promise<BatchData> {
  const res = await fetch(`${apiBase}/api/batch/${batchId}`);
  const json = await res.json() as { success: boolean; data: BatchData; error?: string };
  if (!json.success) {
    throw new Error(json.error || 'Failed to load batch');
  }
  return json.data;
}

async function loadBatchFromFile(filePath: string): Promise<BatchData> {
  const content = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content);
  return parsed.data || parsed;
}

// ============================================
// CLI 入口
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
MDLand Playwright Automation

Usage:
  npx tsx scripts/playwright/mdland-automation.ts <batchId|file.json> [options]

Options:
  --headless     Run in headless mode (no browser window)
  --screenshot   Take screenshots at each step
  --api <url>    API base URL (default: http://150.136.150.184:3001)
  --state <path> Storage state file path
  --help         Show this help

Prerequisites:
  1. Run extract-cookies.ts first to capture MDLand session
  2. Ensure batch data exists (uploaded via /api/batch)

Examples:
  # From batch ID:
  npx tsx scripts/playwright/mdland-automation.ts batch_abc123

  # From JSON file:
  npx tsx scripts/playwright/mdland-automation.ts ./data/batch.json

  # Headless with screenshots:
  npx tsx scripts/playwright/mdland-automation.ts batch_abc123 --headless --screenshot
`);
    return;
  }

  const batchIdOrFile = args[0];
  const headless = args.includes('--headless');
  const screenshot = args.includes('--screenshot');
  const apiIdx = args.indexOf('--api');
  const apiBase = apiIdx >= 0 ? args[apiIdx + 1] : DEFAULT_OPTIONS.apiBase;
  const stateIdx = args.indexOf('--state');
  const statePath = stateIdx >= 0 ? args[stateIdx + 1] : DEFAULT_OPTIONS.storageStatePath;

  // 加载批次数据
  let batchData: BatchData;
  if (batchIdOrFile.endsWith('.json') && existsSync(batchIdOrFile)) {
    console.log(`Loading batch from file: ${batchIdOrFile}`);
    batchData = await loadBatchFromFile(batchIdOrFile);
  } else {
    console.log(`Loading batch from API: ${batchIdOrFile}`);
    batchData = await loadBatchFromAPI(apiBase, batchIdOrFile);
  }

  // 初始化自动化
  const automation = new MDLandAutomation({
    headless,
    screenshot,
    apiBase,
    storageStatePath: statePath
  });

  try {
    await automation.init();

    // 验证 session
    const valid = await automation.validateSession();
    if (!valid) {
      console.error('\nSession expired. Please re-run extract-cookies.ts');
      process.exit(1);
    }

    // 执行批次
    const results = await automation.processBatch(batchData);

    // 退出码
    const hasFailed = results.some(r => !r.success);
    process.exit(hasFailed ? 1 : 0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await automation.close();
  }
}

main();
