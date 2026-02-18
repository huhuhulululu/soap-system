/**
 * 批次数据存储
 *
 * 内存存储 + JSON 文件持久化
 */

import * as fs from 'fs'
import * as path from 'path'
import type { BatchData } from '../types'

const STORE_DIR = path.join(process.cwd(), '.batch-data')

function ensureStoreDir(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true })
  }
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
export function saveBatch(batch: BatchData): void {
  batchCache.set(batch.batchId, batch)
  try {
    ensureStoreDir()
    fs.writeFileSync(batchFilePath(batch.batchId), JSON.stringify(batch, null, 2))
  } catch {
    // 文件写入失败不影响内存缓存
  }
}

/**
 * 获取批次
 */
export function getBatch(batchId: string): BatchData | undefined {
  const cached = batchCache.get(batchId)
  if (cached) return cached

  try {
    const filePath = batchFilePath(batchId)
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as BatchData
      batchCache.set(batchId, data)
      return data
    }
  } catch {
    // 读取失败返回 undefined
  }
  return undefined
}

/**
 * 确认批次 (标记为可执行)
 */
export function confirmBatch(batchId: string): boolean {
  const batch = getBatch(batchId)
  if (!batch) return false
  const confirmed = { ...batch, confirmed: true }
  saveBatch(confirmed)
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
