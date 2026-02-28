/**
 * Tests for automation-runner cookie management (async fs.promises conversion)
 *
 * Covers: hasCookies, saveCookies, loadCookies, decryptCookiesToTempFile,
 *         cleanupTempCookies, getCookiesInfo — all async with fs.promises
 */

import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import crypto from "crypto";

// We need a temp directory for test isolation
const TEST_DATA_DIR = path.join(__dirname, ".tmp-test-data");
const ALGO = "aes-256-gcm";
const TEST_KEY = crypto.randomBytes(32).toString("hex");

// Set env before importing the module
beforeAll(() => {
  process.env.DATA_DIR = TEST_DATA_DIR;
  process.env.COOKIE_ENCRYPTION_KEY = TEST_KEY;
});

// Dynamic import after env is set
let hasCookies: typeof import("../services/automation-runner").hasCookies;
let saveCookies: typeof import("../services/automation-runner").saveCookies;
let loadCookies: typeof import("../services/automation-runner").loadCookies;
let decryptCookiesToTempFile: typeof import("../services/automation-runner").decryptCookiesToTempFile;
let cleanupTempCookies: typeof import("../services/automation-runner").cleanupTempCookies;
let getCookiesInfo: typeof import("../services/automation-runner").getCookiesInfo;

beforeAll(async () => {
  const mod = await import("../services/automation-runner");
  hasCookies = mod.hasCookies;
  saveCookies = mod.saveCookies;
  loadCookies = mod.loadCookies;
  decryptCookiesToTempFile = mod.decryptCookiesToTempFile;
  cleanupTempCookies = mod.cleanupTempCookies;
  getCookiesInfo = mod.getCookiesInfo;
});

beforeEach(async () => {
  // Clean slate for each test
  if (existsSync(TEST_DATA_DIR)) {
    await fs.rm(TEST_DATA_DIR, { recursive: true });
  }
  mkdirSync(TEST_DATA_DIR, { recursive: true });
});

afterAll(async () => {
  if (existsSync(TEST_DATA_DIR)) {
    await fs.rm(TEST_DATA_DIR, { recursive: true });
  }
});

const SAMPLE_STATE = {
  cookies: [
    { name: "session", value: "abc123", sameSite: "Lax" },
    { name: "token", value: "xyz789", sameSite: "None" },
  ],
  origins: [],
};

describe("automation-runner cookie management", () => {
  describe("hasCookies", () => {
    it("returns false when no cookies file exists", async () => {
      const result = await hasCookies();
      expect(result).toBe(false);
    });

    it("returns true after cookies are saved", async () => {
      await saveCookies(SAMPLE_STATE);
      const result = await hasCookies();
      expect(result).toBe(true);
    });
  });

  describe("saveCookies / loadCookies", () => {
    it("round-trips cookies through encrypt/decrypt", async () => {
      await saveCookies(SAMPLE_STATE);
      const loaded = await loadCookies();
      expect(loaded).toEqual(SAMPLE_STATE);
    });

    it("creates DATA_DIR if it does not exist", async () => {
      await fs.rm(TEST_DATA_DIR, { recursive: true });
      expect(existsSync(TEST_DATA_DIR)).toBe(false);

      await saveCookies(SAMPLE_STATE);
      expect(existsSync(TEST_DATA_DIR)).toBe(true);
    });

    it("normalizes invalid sameSite to Lax", async () => {
      const badState = {
        cookies: [{ name: "c", value: "v", sameSite: "INVALID" }],
        origins: [],
      };
      await saveCookies(badState);
      const loaded = (await loadCookies()) as typeof badState;
      expect(loaded.cookies[0].sameSite).toBe("Lax");
    });
  });

  describe("decryptCookiesToTempFile", () => {
    it("writes decrypted JSON to temp file and returns path", async () => {
      await saveCookies(SAMPLE_STATE);
      const tempPath = await decryptCookiesToTempFile();

      expect(typeof tempPath).toBe("string");
      expect(existsSync(tempPath)).toBe(true);

      const content = await fs.readFile(tempPath, "utf8");
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(SAMPLE_STATE);

      // Cleanup
      await cleanupTempCookies();
    });
  });

  describe("cleanupTempCookies", () => {
    it("removes the temp cookies file", async () => {
      await saveCookies(SAMPLE_STATE);
      const tempPath = await decryptCookiesToTempFile();
      expect(existsSync(tempPath)).toBe(true);

      await cleanupTempCookies();
      expect(existsSync(tempPath)).toBe(false);
    });

    it("does not throw if temp file already gone", async () => {
      await expect(cleanupTempCookies()).resolves.toBeUndefined();
    });
  });

  describe("getCookiesInfo", () => {
    it("returns exists:false when no cookies", async () => {
      const info = await getCookiesInfo();
      expect(info).toEqual({ exists: false, updatedAt: null });
    });

    it("returns exists:true with updatedAt after save", async () => {
      await saveCookies(SAMPLE_STATE);
      const info = await getCookiesInfo();

      expect(info.exists).toBe(true);
      expect(info.updatedAt).toBeTruthy();
      // Should be a valid ISO date
      expect(new Date(info.updatedAt!).toISOString()).toBe(info.updatedAt);
    });
  });
});
