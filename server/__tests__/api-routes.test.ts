import { createApp } from '../index'
import { clearAllBatches, saveBatch, getBatch } from '../store/batch-store'
import type { BatchData } from '../types'
import ExcelJS from 'exceljs'
import type { Application } from 'express'
import http from 'http'

/** 轻量 HTTP 测试助手 (无需 supertest 依赖) */
function request(app: Application) {
  let server: http.Server

  function start(): Promise<number> {
    return new Promise((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address()
        const port = typeof addr === 'object' && addr ? addr.port : 0
        resolve(port)
      })
    })
  }

  function stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve())
    })
  }

  async function fetch(
    method: string,
    path: string,
    body?: unknown,
    contentType?: string
  ): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
    const port = await start()
    const url = `http://127.0.0.1:${port}${path}`

    try {
      const headers: Record<string, string> = {}
      let bodyData: string | Buffer | undefined

      if (body instanceof Buffer) {
        // Multipart form data — we'll handle this separately
      } else if (body !== undefined) {
        headers['Content-Type'] = contentType ?? 'application/json'
        bodyData = JSON.stringify(body)
      }

      const res = await globalThis.fetch(url, {
        method,
        headers,
        body: bodyData as BodyInit | undefined,
      })

      const responseBody = await res.json().catch(() => null)
      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => { responseHeaders[k] = v })

      return { status: res.status, body: responseBody, headers: responseHeaders }
    } finally {
      await stop()
    }
  }

  async function uploadFile(
    path: string,
    fileBuffer: Buffer,
    filename: string
  ): Promise<{ status: number; body: unknown }> {
    const port = await start()
    const url = `http://127.0.0.1:${port}${path}`

    try {
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
      const parts: Buffer[] = []

      // File part
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
      ))
      parts.push(fileBuffer)
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`))

      const bodyBuffer = Buffer.concat(parts)

      const res = await globalThis.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: bodyBuffer,
      })

      const responseBody = await res.json().catch(() => null)
      return { status: res.status, body: responseBody }
    } finally {
      await stop()
    }
  }

  return { fetch, uploadFile }
}

/** 创建测试用 Excel buffer */
async function createTestExcel(rows: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')
  if (rows.length === 0) return Buffer.from(await wb.xlsx.writeBuffer())
  ws.addRow(Object.keys(rows[0]))
  for (const row of rows) ws.addRow(Object.values(row))
  return Buffer.from(await wb.xlsx.writeBuffer())
}

describe('batch API routes', () => {
  let app: Application

  beforeEach(() => {
    clearAllBatches()
    app = createApp()
  })

  describe('GET /api/health', () => {
    it('returns ok status', async () => {
      const { fetch: httpFetch } = request(app)
      const res = await httpFetch('GET', '/api/health')

      expect(res.status).toBe(200)
      const body = res.body as Record<string, unknown>
      expect(body.status).toBe('ok')
      expect(body.timestamp).toBeTruthy()
    })
  })

  describe('POST /api/batch', () => {
    it('parses Excel and generates SOAP', async () => {
      const excelBuffer = await createTestExcel([
        {
          Patient: 'CHEN,AIJIN(09/27/1956)',
          Gender: 'F',
          Insurance: 'HF',
          BodyPart: 'LBP',
          Laterality: 'B',
          ICD: 'M54.50,M54.41',
          CPT: '97810,97811x3',
          TotalVisits: 3,
          PainWorst: 8,
          PainBest: 3,
          PainCurrent: 6,
          SymptomDuration: '3 year(s)',
          PainRadiation: 'without radiation',
          PainTypes: 'Dull,Aching',
          AssociatedSymptoms: 'soreness',
          CausativeFactors: 'age related/degenerative changes',
          RelievingFactors: 'Changing positions,Resting,Massage',
          SymptomScale: '70%-80%',
          PainFrequency: 'Constant',
          SecondaryParts: '',
          History: '',
        },
      ])

      const { uploadFile } = request(app)
      const res = await uploadFile('/api/batch', excelBuffer, 'test.xlsx')

      expect(res.status).toBe(200)
      const body = res.body as Record<string, unknown>
      expect(body.success).toBe(true)
      const data = body.data as Record<string, unknown>
      expect(data.batchId).toBeTruthy()
      expect(data.totalPatients).toBe(1)
      expect(data.totalVisits).toBe(3)
      expect(data.totalGenerated).toBe(3)
    })

    it('rejects non-Excel files', async () => {
      const { uploadFile } = request(app)
      const res = await uploadFile('/api/batch', Buffer.from('hello'), 'test.txt')
      // multer file filter rejects, but the exact behavior depends on multer version
      // At minimum it should not return 200 success
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('rejects empty file', async () => {
      const { fetch: httpFetch } = request(app)
      const res = await httpFetch('POST', '/api/batch')

      expect(res.status).toBe(400)
      const body = res.body as Record<string, unknown>
      expect(body.success).toBe(false)
    })
  })

  describe('GET /api/batch/:id', () => {
    it('returns batch by ID', async () => {
      // Pre-save a batch
      const batch: BatchData = {
        batchId: 'test_api_get',
        createdAt: new Date().toISOString(),
        mode: 'full',
        confirmed: false,
        patients: [],
        summary: { totalPatients: 0, totalVisits: 0, byType: {} },
      }
      saveBatch(batch)

      const { fetch: httpFetch } = request(app)
      const res = await httpFetch('GET', '/api/batch/test_api_get')

      expect(res.status).toBe(200)
      const body = res.body as Record<string, unknown>
      expect(body.success).toBe(true)
      const data = body.data as Record<string, unknown>
      expect(data.batchId).toBe('test_api_get')
    })

    it('returns 404 for non-existent batch', async () => {
      const { fetch: httpFetch } = request(app)
      const res = await httpFetch('GET', '/api/batch/nonexistent')

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/batch/:batchId/confirm', () => {
    it('confirms a batch', async () => {
      const batch: BatchData = {
        batchId: 'test_confirm',
        createdAt: new Date().toISOString(),
        mode: 'full',
        confirmed: false,
        patients: [],
        summary: { totalPatients: 0, totalVisits: 0, byType: {} },
      }
      saveBatch(batch)

      const { fetch: httpFetch } = request(app)
      const res = await httpFetch('POST', '/api/batch/test_confirm/confirm')

      expect(res.status).toBe(200)
      const body = res.body as Record<string, unknown>
      expect(body.success).toBe(true)

      // Verify batch is confirmed
      const confirmed = getBatch('test_confirm')
      expect(confirmed?.confirmed).toBe(true)
    })

    it('returns 404 for non-existent batch', async () => {
      const { fetch: httpFetch } = request(app)
      const res = await httpFetch('POST', '/api/batch/nonexistent/confirm')
      expect(res.status).toBe(404)
    })
  })
})
