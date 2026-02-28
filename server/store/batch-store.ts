/**
 * 批次数据存储
 *
 * 内存存储 + JSON 文件持久化（异步 I/O）
 */

import fs from 'fs/promises'
import * as path from 'path'
import type { BatchData } from '../types'

const MAX_CACHE_SIZE = 50
const STORE_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'batches')
  : path.join(process.cwd(), '.batch-data')

async function ensureStoreDir(): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true })
}

function sanitizeBatchId(batchId: string): string {
  const sanitized = batchId.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!sanitized) throw new Error('Invalid batch ID')
  return sanitized
}

function batchFilePath(batchId: string): string {
  return path.join(STORE_DIR, `${sanitizeBatchId(batchId)}.json`)
}

/**
 * 内存缓存 + 文件持久化的批次存储
 */
const batchCache = new Map<string, BatchData>()

/**
 * 生成唯一批次 ID
 */
export function generateBatchId(): string {
  const now = new Date()
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `batch_${datePart}_${timePart}`
}

/**
 * 保存批次
 */
function evictIfNeeded(): void {
  while (batchCache.size > MAX_CACHE_SIZE) {
    const oldest = batchCache.keys().next().value
    if (oldest) batchCache.delete(oldest)
  }
}

export async function saveBatch(batch: BatchData): Promise<void> {
  batchCache.delete(batch.batchId)
  batchCache.set(batch.batchId, batch)
  evictIfNeeded()
  try {
    await ensureStoreDir()
    await fs.writeFile(batchFilePath(batch.batchId), JSON.stringify(batch, null, 2))
  } catch {
    // 文件写入失败不影响内存缓存
  }
}

/**
 * 获取批次
 */
export async function getBatch(batchId: string): Promise<BatchData | undefined> {
  const cached = batchCache.get(batchId)
  if (cached) {
    batchCache.delete(batchId)
    batchCache.set(batchId, cached)
    return cached
  }

  try {
    const raw = await fs.readFile(batchFilePath(batchId), 'utf-8')
    const data = JSON.parse(raw) as BatchData
    batchCache.set(batchId, data)
    return data
  } catch {
    // 读取失败（ENOENT 或 parse 错误）返回 undefined
  }
  return undefined
}

/**
 * 确认批次 (标记为可执行)
 */
export async function confirmBatch(batchId: string): Promise<boolean> {
  const batch = await getBatch(batchId)
  if (!batch) return false
  const confirmed = { ...batch, confirmed: true }
  await saveBatch(confirmed)
  return true
}

/**
 * 列出所有批次 ID
 */
export function listBatchIds(): string[] {
  return [...batchCache.keys()]
}

/**
 * 清除所有批次 (仅用于测试)
 */
export function clearAllBatches(): void {
  batchCache.clear()
}
