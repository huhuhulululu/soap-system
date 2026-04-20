/**
 * pdf-smoke — Playwright-driven smoke test for the Checker PDF upload flow.
 *
 * Usage:
 *   node --import tsx scripts/playwright/pdf-smoke.ts --help
 *   node --import tsx scripts/playwright/pdf-smoke.ts --self-check
 *   node --import tsx scripts/playwright/pdf-smoke.ts --base-url <url> [--pdf <path>] [--cookie <name=val>]
 *
 * Exit codes:
 *   0 — smoke passed (PDF uploaded, Report panel rendered, no PARSE_FAIL)
 *   1 — smoke assertion failed (PARSE_FAIL detected or Report never rendered)
 *   2 — environment not ready (redirected to /portal/, auth required, or
 *       the target URL is unreachable)
 *   3 — CLI misuse (unknown flag, missing required arg)
 *
 * The --self-check mode starts a temporary local HTTP server serving a
 * minimal fixture HTML that mimics the Checker's upload → report-panel
 * flow. This validates the script's Playwright + HTTP wiring without
 * requiring the real /ac/ app. Use this mode in CI; use --base-url for
 * real-environment smoke post-deploy.
 *
 * W1.1 of ROADMAP-2026-04. See `.claude-state/decisions.md` for why the
 * real preview run is deferred to W1.2.
 */

import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Args = {
  help: boolean;
  selfCheck: boolean;
  baseUrl?: string;
  pdf?: string;
  cookie?: string;
};

const FIXTURES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

function printHelp(): void {
  process.stdout.write(
    `pdf-smoke — Playwright smoke for Checker PDF upload

Usage:
  pdf-smoke --help
  pdf-smoke --self-check
  pdf-smoke --base-url <url> [--pdf <path>] [--cookie <name=val>]

Options:
  --help              Print this help and exit 0.
  --self-check        Run against a local fixture HTML (no external deps).
  --base-url <url>    Target URL that serves the Checker UI (e.g.
                      https://rbmeds.com/ac/).
  --pdf <path>        PDF file to upload (default:
                      scripts/playwright/fixtures/sample.pdf; auto-generated
                      if missing).
  --cookie <n=v>      Cookie (e.g. SESSION=abc) to set before navigation.

Exit codes:
  0 pass | 1 smoke fail | 2 env not ready | 3 CLI misuse
`,
  );
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { help: false, selfCheck: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      args.help = true;
    } else if (a === "--self-check") {
      args.selfCheck = true;
    } else if (a === "--base-url") {
      args.baseUrl = argv[++i];
    } else if (a === "--pdf") {
      args.pdf = argv[++i];
    } else if (a === "--cookie") {
      args.cookie = argv[++i];
    } else {
      process.stderr.write(`pdf-smoke: unknown argument ${JSON.stringify(a)}\n`);
      process.exit(3);
    }
  }
  return args;
}

/**
 * Writes a minimal valid PDF (≈ 200 bytes) to `path` if it does not exist.
 * This avoids committing a binary fixture while still giving the smoke
 * flow a real-enough PDF to upload.
 */
function ensureSamplePdf(path: string): void {
  if (existsSync(path)) return;
  const pdf = `%PDF-1.4
1 0 obj
<</Type/Catalog/Pages 2 0 R>>
endobj
2 0 obj
<</Type/Pages/Kids[3 0 R]/Count 1>>
endobj
3 0 obj
<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>>>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000051 00000 n
0000000095 00000 n
trailer
<</Size 4/Root 1 0 R>>
startxref
158
%%EOF
`;
  writeFileSync(path, pdf, "binary");
}

async function startSelfCheckServer(): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const html = readFileSync(join(FIXTURES_DIR, "self-check.html"), "utf8");
  const server = createServer((req, res) => {
    if (req.url === "/" || req.url?.startsWith("/?")) {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(html);
      return;
    }
    res.writeHead(404).end("not found");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise<void>((r, reject) =>
        server.close((err) => (err ? reject(err) : r())),
      ),
  };
}

async function runSmoke(opts: {
  baseUrl: string;
  pdf: string;
  cookie?: string;
  expectPortalRedirect?: boolean;
}): Promise<number> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    if (opts.cookie) {
      const eqIdx = opts.cookie.indexOf("=");
      if (eqIdx > 0) {
        const name = opts.cookie.slice(0, eqIdx);
        const value = opts.cookie.slice(eqIdx + 1);
        const url = new URL(opts.baseUrl);
        await context.addCookies([
          {
            name,
            value,
            domain: url.hostname,
            path: "/",
            httpOnly: false,
            secure: url.protocol === "https:",
            sameSite: "Lax",
          },
        ]);
      }
    }
    const page = await context.newPage();
    const resp = await page
      .goto(opts.baseUrl, { waitUntil: "domcontentloaded", timeout: 20_000 })
      .catch((err: Error) => {
        process.stderr.write(`pdf-smoke: navigation failed: ${err.message}\n`);
        return null;
      });
    if (!resp) return 2;

    // Detect auth redirect to /portal/ — env-not-ready exit code.
    if (page.url().includes("/portal/")) {
      process.stderr.write(
        `pdf-smoke: redirected to ${page.url()} — auth cookie likely missing (exit 2)\n`,
      );
      return 2;
    }

    const uploader = page.locator('[data-testid=file-uploader]').first();
    const uploaderExists = await uploader.count();
    if (uploaderExists === 0) {
      // Fall back to any file input
      const fallback = page.locator('input[type=file]').first();
      if ((await fallback.count()) === 0) {
        process.stderr.write(
          `pdf-smoke: no file upload control found on ${opts.baseUrl}\n`,
        );
        return 2;
      }
      await fallback.setInputFiles(opts.pdf);
    } else {
      await uploader.setInputFiles(opts.pdf);
    }

    // Wait for a report panel / result marker.
    const report = page.locator('[data-testid=report-panel]').first();
    const reportExists = await report.count();
    if (reportExists > 0) {
      await report.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    } else {
      // Fallback: wait for the literal text "Report" or "Summary"
      await page
        .getByText(/Report|Summary/i)
        .first()
        .waitFor({ state: "visible", timeout: 15_000 })
        .catch(() => {});
    }

    // Inspect the report panel's rendered text, not the full page HTML
    // (full HTML would include inline scripts containing PARSE_FAIL as a
    // literal regardless of which code path ran).
    const reportText = await (reportExists > 0
      ? report.innerText().catch(() => "")
      : page
          .locator("body")
          .innerText()
          .catch(() => ""));
    if (/PARSE_FAIL/.test(reportText)) {
      process.stderr.write(
        `pdf-smoke: PARSE_FAIL detected in report panel\n`,
      );
      return 1;
    }
    if (!/Report|Summary|Ready/i.test(reportText)) {
      process.stderr.write(
        `pdf-smoke: no Report/Summary marker in report panel\n`,
      );
      return 1;
    }
    return 0;
  } finally {
    await browser.close();
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  const pdfPath = args.pdf ?? join(FIXTURES_DIR, "sample.pdf");
  ensureSamplePdf(pdfPath);

  if (args.selfCheck) {
    const server = await startSelfCheckServer();
    try {
      return await runSmoke({ baseUrl: server.url, pdf: pdfPath });
    } finally {
      await server.close().catch(() => {});
    }
  }

  if (!args.baseUrl) {
    process.stderr.write(
      `pdf-smoke: --base-url is required (or use --self-check). See --help.\n`,
    );
    return 3;
  }

  return runSmoke({
    baseUrl: args.baseUrl,
    pdf: pdfPath,
    cookie: args.cookie,
  });
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`pdf-smoke: unhandled error: ${String(err)}\n`);
    process.exit(1);
  });
