/**
 * Automation API Routes
 *
 * POST   /api/automate/cookies        - Upload MDLand storage state (cookies)
 * GET    /api/automate/cookies         - Check cookies status
 * POST   /api/automate/:batchId       - Trigger automation for a batch
 * GET    /api/automate/:batchId       - Get automation status + logs
 * POST   /api/automate/:batchId/stop  - Stop running automation
 */

import { Router, type Request, type Response } from 'express'
import {
  saveCookies,
  getCookiesInfo,
  hasCookies,
  startAutomation,
  getJobStatus,
  getActiveJob,
  isRunning,
  stopAutomation,
} from '../services/automation-runner'
import { getBatch } from '../store/batch-store'

export function createAutomateRouter(): Router {
  const router = Router()

  /**
   * POST /api/automate/cookies — upload MDLand storage state JSON
   */
  router.post('/cookies', (req: Request, res: Response) => {
    try {
      const body = req.body

      if (!body || typeof body !== 'object') {
        res.status(400).json({ success: false, error: 'Request body must be a JSON object' })
        return
      }

      // Accept raw array or {cookies:[...]} format
      const storageState = Array.isArray(body)
        ? { cookies: body, origins: [] }
        : body

      if (!Array.isArray(storageState.cookies)) {
        res.status(400).json({
          success: false,
          error: 'Expected {cookies:[...]} or a raw cookies array',
        })
        return
      }

      saveCookies(storageState)

      res.json({
        success: true,
        data: {
          cookieCount: storageState.cookies.length,
          ...getCookiesInfo(),
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  })

  /**
   * GET /api/automate/cookies — check if cookies exist
   */
  router.get('/cookies', (_req: Request, res: Response) => {
    try {
      const info = getCookiesInfo()
      res.json({ success: true, data: info })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  })

  /**
   * POST /api/automate/:batchId — trigger headless automation
   */
  router.post('/:batchId', (req: Request, res: Response) => {
    try {
      const batchId = String(req.params.batchId)

      const batch = getBatch(batchId)
      if (!batch) {
        res.status(404).json({ success: false, error: 'Batch not found' })
        return
      }
      if (!batch.confirmed) {
        res.status(400).json({ success: false, error: 'Batch not confirmed yet' })
        return
      }

      if (!hasCookies()) {
        res.status(400).json({
          success: false,
          error: 'MDLand cookies not uploaded. Upload storage state first.',
        })
        return
      }

      if (isRunning()) {
        const active = getActiveJob()
        res.status(409).json({
          success: false,
          error: `Automation already running for batch ${active?.batchId}`,
        })
        return
      }

      const port = process.env.PORT || '3001'
      const apiBase = `http://localhost:${port}`
      const job = startAutomation(batchId, apiBase)

      res.json({ success: true, data: job })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  })

  /**
   * GET /api/automate/:batchId — get automation status + logs
   */
  router.get('/:batchId', (req: Request, res: Response) => {
    try {
      const batchId = String(req.params.batchId)
      const job = getJobStatus(batchId)

      if (!job) {
        res.json({
          success: true,
          data: { batchId, status: 'idle', logs: [], exitCode: null },
        })
        return
      }

      res.json({ success: true, data: job })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  })

  /**
   * POST /api/automate/:batchId/stop — stop running automation
   */
  router.post('/:batchId/stop', (req: Request, res: Response) => {
    try {
      const stopped = stopAutomation()
      if (!stopped) {
        res.status(404).json({ success: false, error: 'No running automation to stop' })
        return
      }
      res.json({ success: true, data: { stopped: true } })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ success: false, error: message })
    }
  })

  return router
}
