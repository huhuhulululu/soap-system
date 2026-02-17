/**
 * SOAP Batch API Server
 *
 * Express 服务入口，提供批量 SOAP 笔记生成 API
 */

import express from 'express'
import cors from 'cors'
import { createBatchRouter } from './routes/batch'

export function createApp(): express.Application {
  const app = express()

  app.use(cors())
  app.use(express.json())

  // 批量处理路由
  app.use('/api/batch', createBatchRouter())

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  return app
}

// 直接运行时启动服务器
if (require.main === module) {
  const port = parseInt(process.env.PORT ?? '3001', 10)
  const app = createApp()
  app.listen(port, () => {
    console.log(`SOAP Batch API running on port ${port}`)
  })
}
