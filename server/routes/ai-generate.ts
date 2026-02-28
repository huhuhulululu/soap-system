/**
 * AI Generate API Route
 *
 * POST /api/ai/generate — Generate SOAP note via Vertex AI fine-tuned model
 */

import { Router, type Request, type Response } from 'express'
import { generateWithAI, type AIGenerateInput } from '../services/ai-generator'

export function createAIGenerateRouter(): Router {
  const router = Router()

  router.post('/generate', async (req: Request, res: Response) => {
    const input = req.body as AIGenerateInput

    if (!input.bodyPart || !input.noteType || !input.laterality) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: bodyPart, noteType, laterality',
      })
      return
    }

    const result = await generateWithAI(input)
    res.json(result)
  })

  return router
}
