/**
 * MDLand Cookie Extractor
 *
 * 从已登录的 Chrome 浏览器提取 MDLand session cookies
 * 两种模式:
 *   1. CDP 模式 — 连接到已打开的 Chrome 实例 (推荐)
 *   2. 手动模式 — 用户手动登录后自动保存
 *
 * 使用方法:
 *   # 先以 debug 模式启动 Chrome:
 *   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *     --remote-debugging-port=9222 \
 *     --user-data-dir=/tmp/chrome-mdland
 *
 *   # 手动登录 MDLand 后运行:
 *   npx tsx scripts/playwright/extract-cookies.ts
 */

import { chromium, type BrowserContext } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const STORAGE_STATE_PATH = join(
  dirname(dirname(__dirname)),
  'data',
  'mdland-storage-state.json'
);

const CDP_ENDPOINT = 'http://127.0.0.1:9222';

interface ExtractResult {
  readonly success: boolean;
  readonly cookieCount: number;
  readonly path: string;
  readonly error?: string;
}

/**
 * 通过 CDP 连接到已登录的 Chrome 并提取 cookies
 */
async function extractViaCDP(): Promise<ExtractResult> {
  let browser;
  try {
    console.log(`Connecting to Chrome via CDP at ${CDP_ENDPOINT}...`);
    browser = await chromium.connectOverCDP(CDP_ENDPOINT);

    const contexts = browser.contexts();
    if (contexts.length === 0) {
      return {
        success: false,
        cookieCount: 0,
        path: STORAGE_STATE_PATH,
        error: 'No browser contexts found'
      };
    }

    // 使用第一个 context（默认 profile）
    const context = contexts[0];
    const pages = context.pages();

    // 检查是否有 MDLand 页面
    const mdlandPage = pages.find(p =>
      p.url().includes('mdland.net') || p.url().includes('mdland.com')
    );

    if (!mdlandPage) {
      console.log('Available pages:');
      pages.forEach((p, i) => console.log(`  [${i}] ${p.url()}`));
      return {
        success: false,
        cookieCount: 0,
        path: STORAGE_STATE_PATH,
        error: 'No MDLand page found. Please login to MDLand first.'
      };
    }

    console.log(`Found MDLand page: ${mdlandPage.url()}`);

    // 验证 session 是否有效
    const sessionValid = await validateSession(mdlandPage);
    if (!sessionValid) {
      return {
        success: false,
        cookieCount: 0,
        path: STORAGE_STATE_PATH,
        error: 'MDLand session appears expired. Please re-login.'
      };
    }

    // 保存 storage state
    return await saveStorageState(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ECONNREFUSED')) {
      return {
        success: false,
        cookieCount: 0,
        path: STORAGE_STATE_PATH,
        error: [
          'Cannot connect to Chrome. Start Chrome with:',
          '',
          '  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\',
          '    --remote-debugging-port=9222 \\',
          '    --user-data-dir=/tmp/chrome-mdland',
          '',
          'Then login to MDLand and run this script again.'
        ].join('\n')
      };
    }
    return {
      success: false,
      cookieCount: 0,
      path: STORAGE_STATE_PATH,
      error: message
    };
  }
  // CDP 连接不应关闭浏览器本身
}

/**
 * 交互模式 — 打开浏览器让用户手动登录
 */
async function extractViaManualLogin(mdlandUrl: string): Promise<ExtractResult> {
  console.log('Opening browser for manual login...');
  console.log('Please login to MDLand. The cookies will be saved automatically.');
  console.log('Press Ctrl+C to cancel.\n');

  const browser = await chromium.launch({
    headful: true,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null // 使用窗口尺寸
  });

  const page = await context.newPage();
  await page.goto(mdlandUrl);

  // 等待用户登录 — 检测 workarea0 或 g_sessionID 存在
  console.log('Waiting for login...');

  try {
    await page.waitForFunction(
      () => {
        const wa0 = document.getElementById('workarea0') as HTMLIFrameElement | null;
        const sessionId = (window as unknown as Record<string, unknown>).g_sessionID;
        return (wa0 !== null) || (sessionId !== undefined && sessionId !== '');
      },
      { timeout: 300000 } // 5 分钟超时
    );

    console.log('Login detected! Saving cookies...');
    await page.waitForTimeout(2000); // 等待 session 稳定

    const result = await saveStorageState(context);
    await browser.close();
    return result;
  } catch (err) {
    await browser.close();
    return {
      success: false,
      cookieCount: 0,
      path: STORAGE_STATE_PATH,
      error: 'Login timeout (5 minutes). Please try again.'
    };
  }
}

/**
 * 验证 MDLand session 是否有效
 */
async function validateSession(page: Awaited<ReturnType<BrowserContext['newPage']>>): Promise<boolean> {
  try {
    const result = await page.evaluate(() => {
      const wa0 = document.getElementById('workarea0');
      const sessionId = (window as unknown as Record<string, unknown>).g_sessionID;
      return {
        hasWorkarea: wa0 !== null,
        hasSessionId: sessionId !== undefined && sessionId !== '',
        url: window.location.href
      };
    });

    console.log('Session check:', {
      hasWorkarea: result.hasWorkarea,
      hasSessionId: result.hasSessionId
    });

    return result.hasWorkarea || result.hasSessionId;
  } catch {
    return false;
  }
}

/**
 * 保存 storageState 到文件
 */
async function saveStorageState(context: BrowserContext): Promise<ExtractResult> {
  const dir = dirname(STORAGE_STATE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const storageState = await context.storageState();

  // 过滤只保留 MDLand 相关 cookies
  const mdlandCookies = storageState.cookies.filter(
    c => c.domain.includes('mdland')
  );

  const filteredState = {
    ...storageState,
    cookies: mdlandCookies
  };

  writeFileSync(STORAGE_STATE_PATH, JSON.stringify(filteredState, null, 2));

  console.log(`\nSaved ${mdlandCookies.length} cookies to ${STORAGE_STATE_PATH}`);
  console.log('Cookie domains:', Array.from(new Set(mdlandCookies.map(c => c.domain))));

  return {
    success: true,
    cookieCount: mdlandCookies.length,
    path: STORAGE_STATE_PATH
  };
}

// ============================================
// CLI 入口
// ============================================
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'cdp';
  const mdlandUrl = args[1] || 'https://ehr.mdland.net';

  console.log('=== MDLand Cookie Extractor ===\n');

  let result: ExtractResult;

  if (mode === 'manual') {
    result = await extractViaManualLogin(mdlandUrl);
  } else {
    result = await extractViaCDP();
  }

  if (result.success) {
    console.log('\nSuccess! Storage state saved.');
    console.log(`Path: ${result.path}`);
    console.log(`Cookies: ${result.cookieCount}`);
    console.log('\nNext step: npx tsx scripts/playwright/mdland-automation.ts <batchId>');
  } else {
    console.error(`\nFailed: ${result.error}`);
    process.exit(1);
  }
}

main();
