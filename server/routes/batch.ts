/**
 * 批量处理 API 路由
 *
 * POST   /api/batch              - 上传 Excel → 解析 (soap-only: parse only / full: parse+generate)
 * GET    /api/batch/:id          - 获取 batch 详情
 * PUT    /api/batch/:batchId/visit/:patientIdx/:visitIdx - 重新生成单个 visit
 * POST   /api/batch/:batchId/generate - 生成所有 SOAP (soap-only 模式用)
 * POST   /api/batch/:batchId/confirm - 确认 batch
 * GET    /api/template           - 下载 Excel 模板
 */

import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { parseExcelBuffer, buildPatientsFromRows } from '../services/excel-parser'
import { generateBatch, generateContinueBatch, generateMixedBatch, regenerateVisit } from '../services/batch-generator'
import { generateBatchId, saveBatch, getBatch, confirmBatch } from '../store/batch-store'
import type { BatchData, BatchMode } from '../types'

const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])
const XLS_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0])

function isValidExcelBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false
  const head = buf.slice(0, 4)
  return head.equals(XLSX_MAGIC) || head.equals(XLS_MAGIC)
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.xlsx', '.xls'].includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Only .xlsx and .xls files are allowed'))
    }
  },
})

export function createBatchRouter(): Router {
  const router = Router()

  /**
   * POST /api/batch - 上传 Excel 并生成 SOAP
   */
  router.post('/', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' })
        return
      }

      if (!isValidExcelBuffer(req.file.buffer)) {
        res.status(400).json({ success: false, error: 'Invalid file format' })
        return
      }

      // 1. 读取 mode + realisticPatch + disableChronicCaps
      const rawMode = req.body?.mode as string
      const mode: BatchMode = rawMode === 'soap-only' ? 'soap-only' : rawMode === 'continue' ? 'continue' : 'full'
      const realisticPatch = req.body?.realisticPatch === true || req.body?.realisticPatch === 'true'
      const disableChronicCaps = req.body?.disableChronicCaps === true || req.body?.disableChronicCaps === 'true'

      // 2. 解析 Excel
      const rows = await parseExcelBuffer(req.file.buffer)

      // 3. 解析患者 + 自动展开 visits
      const { patients, summary } = buildPatientsFromRows(rows, mode)

      // 4. 构造 BatchData
      const batchId = generateBatchId()
      const batchData: BatchData = {
        batchId,
        createdAt: new Date().toISOString(),
        mode,
        confirmed: false,
        patients,
        summary,
      }

      // 5. Generate via mixed handler (supports per-patient modes)
      const result = generateMixedBatch(batchData, realisticPatch, disableChronicCaps)
      await saveBatch({ ...batchData, patients: result.patients })

      res.json({
        success: true,
        data: {
          batchId,
          totalPatients: summary.totalPatients,
          totalVisits: summary.totalVisits,
          totalGenerated: result.totalGenerated,
          totalFailed: result.totalFailed,
          byType: summary.byType,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(400).json({ success: false, error: message })
    }
  })

  /**
   * POST /api/batch/json - JSON 提交患者数据 (网页表单)
   */
  router.post('/json', async (req: Request, res: Response) => {
    try {
      const { rows, mode: rawMode, realisticPatch: rawPatch, disableChronicCaps: rawChronicCaps } = req.body ?? {}
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ success: false, error: 'rows[] is required' })
        return
      }

      const mode: BatchMode = rawMode === 'soap-only' ? 'soap-only' : rawMode === 'continue' ? 'continue' : 'full'
      const realisticPatch = rawPatch === true || rawPatch === 'true'
      const disableChronicCaps = rawChronicCaps === true || rawChronicCaps === 'true'
      const { patients, summary } = buildPatientsFromRows(rows, mode)

      const batchId = generateBatchId()
      const batchData: BatchData = {
        batchId,
        createdAt: new Date().toISOString(),
        mode,
        confirmed: false,
        patients,
        summary,
      }

      // Always generate via mixed handler (supports per-patient modes)
      const result = generateMixedBatch(batchData, realisticPatch, disableChronicCaps)
      await saveBatch({ ...batchData, patients: result.patients })
      res.json({ success: true, data: { batchId, totalPatients: summary.totalPatients, totalVisits: summary.totalVisits, totalGenerated: result.totalGenerated, totalFailed: result.totalFailed, byType: summary.byType } })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(400).json({ success: false, error: message })
    }
  })

  /**
   * GET /api/batch/:id - 获取 batch 详情
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id)
      const batch = await getBatch(id)
      if (!batch) {
        res.status(404).json({ success: false, error: 'Batch not found' })
        return
      }
      res.json({ success: true, data: batch })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  })

  /**
   * PUT /api/batch/:batchId/visit/:patientIdx/:visitIdx - 重新生成单个 visit
   */
  router.put('/:batchId/visit/:patientIdx/:visitIdx', async (req: Request, res: Response) => {
    try {
      const batchId = String(req.params.batchId)
      const batch = await getBatch(batchId)
      if (!batch) {
        res.status(404).json({ success: false, error: 'Batch not found' })
        return
      }

      const patientIdx = parseInt(String(req.params.patientIdx), 10)
      const visitIdx = parseInt(String(req.params.visitIdx), 10)

      if (isNaN(patientIdx) || isNaN(visitIdx)) {
        res.status(400).json({ success: false, error: 'Invalid patient or visit index' })
        return
      }

      const patient = batch.patients[patientIdx]
      if (!patient) {
        res.status(404).json({ success: false, error: 'Patient not found' })
        return
      }

      const visit = patient.visits[visitIdx]
      if (!visit) {
        res.status(404).json({ success: false, error: 'Visit not found' })
        return
      }

      const seed = req.body?.seed as number | undefined
      const realisticPatchFlag = req.body?.realisticPatch === true || req.body?.realisticPatch === 'true'
      const disableChronicCapsFlag = req.body?.disableChronicCaps === true || req.body?.disableChronicCaps === 'true'
      const regenerated = regenerateVisit(patient, visit, seed, realisticPatchFlag, disableChronicCapsFlag)

      // 更新 batch (immutable pattern)
      const updatedVisits = patient.visits.map((v, i) =>
        i === visitIdx ? regenerated : v
      )
      const updatedPatients = batch.patients.map((p, i) =>
        i === patientIdx ? { ...p, visits: updatedVisits } : p
      )
      const updatedBatch: BatchData = { ...batch, patients: updatedPatients }
      await saveBatch(updatedBatch)

      res.json({
        success: true,
        data: {
          patientIndex: patientIdx,
          visitIndex: visitIdx,
          generated: regenerated.generated,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  })

  /**
   * POST /api/batch/:batchId/generate - 生成所有 SOAP (soap-only 模式)
   */
  router.post('/:batchId/generate', async (req: Request, res: Response) => {
    try {
      const batch = await getBatch(String(req.params.batchId))
      if (!batch) {
        res.status(404).json({ success: false, error: 'Batch not found' })
        return
      }

      const realisticPatchGen = req.body?.realisticPatch === true || req.body?.realisticPatch === 'true'
      const disableChronicCapsGen = req.body?.disableChronicCaps === true || req.body?.disableChronicCaps === 'true'
      const result = generateMixedBatch(batch, realisticPatchGen, disableChronicCapsGen)
      const updatedBatch: BatchData = { ...batch, patients: result.patients }
      await saveBatch(updatedBatch)

      res.json({
        success: true,
        data: {
          totalGenerated: result.totalGenerated,
          totalFailed: result.totalFailed,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  })

  /**
   * POST /api/batch/:batchId/confirm - 确认 batch
   */
  router.post('/:batchId/confirm', async (req: Request, res: Response) => {
    try {
      const result = await confirmBatch(String(req.params.batchId))
      if (!result) {
        res.status(404).json({ success: false, error: 'Batch not found' })
        return
      }
      res.json({ success: true, data: { confirmed: true } })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  })

  /**
   * GET /api/template - 下载 Excel 模板
   */
  router.get('/template/download', (_req: Request, res: Response) => {
    try {
      const templatePath = path.resolve(__dirname, '../../templates/batch-template.xlsx')
      if (!fs.existsSync(templatePath)) {
        res.status(404).json({ success: false, error: 'Template file not found' })
        return
      }
      res.download(templatePath, 'batch-template.xlsx')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  })

  return router
}
