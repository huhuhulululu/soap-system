import {
  generateBatchId,
  saveBatch,
  getBatch,
  confirmBatch,
  listBatchIds,
  clearAllBatches,
} from "../store/batch-store";
import type { BatchData } from "../types";

function makeBatch(id?: string): BatchData {
  return {
    batchId: id ?? generateBatchId(),
    createdAt: new Date().toISOString(),
    mode: "full",
    confirmed: false,
    patients: [],
    summary: {
      totalPatients: 0,
      totalVisits: 0,
      byType: {},
    },
  };
}

describe("batch-store", () => {
  beforeEach(() => {
    clearAllBatches();
  });

  describe("generateBatchId", () => {
    it("generates ID with batch_ prefix", () => {
      const id = generateBatchId();
      expect(id).toMatch(/^batch_\d{8}_\d{6}$/);
    });

    it("generates IDs with current date", () => {
      const id = generateBatchId();
      const now = new Date();
      const year = String(now.getFullYear());
      expect(id).toContain(year);
    });
  });

  describe("saveBatch / getBatch", () => {
    it("saves and retrieves a batch", async () => {
      const batch = makeBatch("test_batch_1");
      await saveBatch(batch);

      const retrieved = await getBatch("test_batch_1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.batchId).toBe("test_batch_1");
    });

    it("returns undefined for non-existent batch", async () => {
      expect(await getBatch("nonexistent")).toBeUndefined();
    });

    it("overwrites existing batch", async () => {
      const batch1 = makeBatch("test_batch_2");
      await saveBatch(batch1);

      const batch2 = { ...batch1, confirmed: true };
      await saveBatch(batch2);

      const retrieved = await getBatch("test_batch_2");
      expect(retrieved?.confirmed).toBe(true);
    });
  });

  describe("confirmBatch", () => {
    it("confirms an existing batch", async () => {
      const batch = makeBatch("test_confirm");
      await saveBatch(batch);

      const result = await confirmBatch("test_confirm");
      expect(result).toBe(true);

      const confirmed = await getBatch("test_confirm");
      expect(confirmed?.confirmed).toBe(true);
    });

    it("returns false for non-existent batch", async () => {
      expect(await confirmBatch("nonexistent")).toBe(false);
    });
  });

  describe("listBatchIds", () => {
    it("returns empty array initially", () => {
      expect(listBatchIds()).toEqual([]);
    });

    it("returns saved batch IDs", async () => {
      await saveBatch(makeBatch("a"));
      await saveBatch(makeBatch("b"));

      const ids = listBatchIds();
      expect(ids).toContain("a");
      expect(ids).toContain("b");
    });
  });

  describe("clearAllBatches", () => {
    it("clears in-memory cache", async () => {
      await saveBatch(makeBatch("x"));
      await saveBatch(makeBatch("y"));
      clearAllBatches();

      expect(listBatchIds()).toEqual([]);
    });
  });
});
