import { createApp } from '../index'
import jwt from 'jsonwebtoken'
import type { Application } from 'express'
import http from 'http'

/** 轻量 HTTP 测试助手 — 支持 cookie 注入 */
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
      server.close((err) => (err ? reject(err) : resolve()))
    })
  }

  async function fetch(
    method: string,
    path: string,
    options?: { cookies?: Record<string, string>; headers?: Record<string, string> },
  ): Promise<{ status: number; body: unknown }> {
    const port = await start()
    const url = `http://127.0.0.1:${port}${path}`

    try {
      const headers: Record<string, string> = { ...options?.headers }

      if (options?.cookies) {
        headers['Cookie'] = Object.entries(options.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ')
      }

      const res = await globalThis.fetch(url, { method, headers })
      const responseBody = await res.json().catch(() => null)
      return { status: res.status, body: responseBody }
    } finally {
      await stop()
    }
  }

  return { fetch }
}

const JWT_SECRET = 'test-jwt-secret'

function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, JWT_SECRET)
}

describe('requireAuth middleware', () => {
  const savedEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...savedEnv }
  })

  describe('production + no API_KEY', () => {
    it('rejects unauthenticated requests with 401', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SHARED_JWT_SECRET = JWT_SECRET
      delete process.env.API_KEY

      const app = createApp()
      const { fetch: httpFetch } = request(app)

      // Hit a protected route with no JWT and no API key
      const res = await httpFetch('GET', '/api/batch/test123')

      expect(res.status).toBe(401)
      const body = res.body as Record<string, unknown>
      expect(body.success).toBe(false)
    })

    it('allows requests with valid JWT', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SHARED_JWT_SECRET = JWT_SECRET
      delete process.env.API_KEY

      const token = signToken({ username: 'doc', role: 'admin', ac_access: true })
      const app = createApp()
      const { fetch: httpFetch } = request(app)

      // Protected route, but valid JWT cookie present
      const res = await httpFetch('GET', '/api/batch/test123', {
        cookies: { rbmeds_token: token },
      })

      // Should pass auth (404 because batch doesn't exist, but NOT 401)
      expect(res.status).not.toBe(401)
      expect(res.status).not.toBe(403)
    })
  })

  describe('development + no API_KEY', () => {
    it('allows unauthenticated requests (dev convenience)', async () => {
      process.env.NODE_ENV = 'development'
      delete process.env.API_KEY
      delete process.env.SHARED_JWT_SECRET

      const app = createApp()
      const { fetch: httpFetch } = request(app)

      const res = await httpFetch('GET', '/api/batch/test123')

      // Should pass auth (404 because batch doesn't exist, but NOT 401)
      expect(res.status).not.toBe(401)
      expect(res.status).not.toBe(403)
    })
  })
})
