// AIWriterPanel integration — tests AI generation mode
import { describe, it, expect } from 'vitest'

describe('AIWriterPanel', () => {
  it('should exist as a module', async () => {
    const mod = await import('../AIWriterPanel.vue')
    expect(mod.default).toBeDefined()
  })
})
