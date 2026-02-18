/**
 * SOAP Batch API Server
 *
 * Express 服务入口，提供批量 SOAP 笔记生成 API
 */

import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { createBatchRouter } from './routes/batch'
import { createAutomateRouter } from './routes/automate'

// ── Auth Middleware ──────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY
  if (!apiKey) {
    next()
    return
  }
  const provided = req.headers['x-api-key']
  if (provided !== apiKey) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }
  next()
}

// ── App Factory ─────────────────────────────────

export function createApp(): express.Application {
  const app = express()

  // S1: Restrict CORS to known origin
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:9090',
    methods: ['GET', 'POST', 'PUT'],
  }))

  app.use(express.json({ limit: '1mb' }))

  // S5: Rate limiting
  const apiLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false })
  const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 5, standardHeaders: true, legacyHeaders: false })

  app.use('/api/', apiLimiter)
  app.use('/api/automate/login', loginLimiter)

  // 健康检查 (无需认证)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // S3: Protected routes
  app.use('/api/batch', requireAuth, createBatchRouter())
  app.use('/api/automate', requireAuth, createAutomateRouter())

  return app
}

// 直接运行时启动服务器
if (require.main === module) {
  const port = parseInt(process.env.PORT ?? '3001', 10)
  const app = createApp()
  app.listen(port, () => {
    process.stdout.write(`SOAP Batch API running on port ${port}\n`)
  })
}
