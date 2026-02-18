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
import { generateBatch, regenerateVisit } from '../services/batch-generator'
import { generateBatchId, saveBatch, getBatch, confirmBatch } from '../store/batch-store'
import type { BatchData, BatchMode } from '../types'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

      // 1. 读取 mode
      const mode: BatchMode = req.body?.mode === 'soap-only' ? 'soap-only' : 'full'

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

      // 5. soap-only: parse only, no generation yet
      if (mode === 'soap-only') {
        saveBatch(batchData)
        res.json({
          success: true,
          data: {
            batchId,
            totalPatients: summary.totalPatients,
            totalVisits: summary.totalVisits,
            totalGenerated: 0,
            totalFailed: 0,
            byType: summary.byType,
          },
        })
        return
      }

      // 6. full mode: generate immediately
      const result = generateBatch(batchData)
      const finalBatch: BatchData = {
        ...batchData,
        patients: result.patients,
      }
      saveBatch(finalBatch)

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
   * GET /api/batch/:id - 获取 batch 详情
   */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id)
      const batch = getBatch(id)
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
  router.put('/:batchId/visit/:patientIdx/:visitIdx', (req: Request, res: Response) => {
    try {
      const batchId = String(req.params.batchId)
      const batch = getBatch(batchId)
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
      const regenerated = regenerateVisit(patient, visit, seed)

      // 更新 batch (immutable pattern)
      const updatedVisits = patient.visits.map((v, i) =>
        i === visitIdx ? regenerated : v
      )
      const updatedPatients = batch.patients.map((p, i) =>
        i === patientIdx ? { ...p, visits: updatedVisits } : p
      )
      const updatedBatch: BatchData = { ...batch, patients: updatedPatients }
      saveBatch(updatedBatch)

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
  router.post('/:batchId/generate', (req: Request, res: Response) => {
    try {
      const batch = getBatch(String(req.params.batchId))
      if (!batch) {
        res.status(404).json({ success: false, error: 'Batch not found' })
        return
      }

      const result = generateBatch(batch)
      const updatedBatch: BatchData = { ...batch, patients: result.patients }
      saveBatch(updatedBatch)

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
  router.post('/:batchId/confirm', (req: Request, res: Response) => {
    try {
      const result = confirmBatch(String(req.params.batchId))
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
