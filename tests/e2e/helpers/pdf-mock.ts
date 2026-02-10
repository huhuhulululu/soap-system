/**
 * PDF Text Extraction Helper
 * 用于测试的 PDF 文本提取
 */

import * as fs from 'fs'

/**
 * 从 PDF 文件提取文本
 * 注意: 实际使用需要 pdfjs-dist，这里提供 mock 实现
 */
export async function extractPdfText(filePath: string): Promise<string> {
  // 尝试使用 pdfjs-dist
  try {
    const pdfjs = await import('pdfjs-dist')
    const data = new Uint8Array(fs.readFileSync(filePath))
    const doc = await pdfjs.getDocument({ data }).promise
    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((item: any) => item.str).join(' ') + '\n'
    }
    return text
  } catch {
    // Fallback: 返回空字符串，测试将跳过
    console.warn(`Cannot extract PDF: ${filePath}`)
    return ''
  }
}

/**
 * 从预处理的文本文件加载
 */
export function loadPreprocessedText(txtPath: string): string {
  if (fs.existsSync(txtPath)) {
    return fs.readFileSync(txtPath, 'utf-8')
  }
  return ''
}
