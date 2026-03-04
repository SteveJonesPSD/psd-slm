/**
 * PDF text extraction — tries native text layer first, falls back to Claude vision OCR
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ExtractionResult } from './types'

const MIN_TEXT_LENGTH = 50

/**
 * Extract text from a PDF buffer.
 * 1. Try pdf-parse for born-digital PDFs (text layer)
 * 2. If text is too short (<50 chars), fall back to Claude document input for scanned PDFs
 */
export async function extractTextFromPDF(
  pdfBuffer: Buffer,
  apiKey: string
): Promise<ExtractionResult> {
  // Try native text extraction first
  const nativeText = await tryNativeExtraction(pdfBuffer)

  if (nativeText && nativeText.replace(/\s/g, '').length >= MIN_TEXT_LENGTH) {
    return {
      rawText: nativeText,
      method: 'text_layer',
    }
  }

  // Fall back to Claude document input for scanned PDFs
  const ocrText = await extractWithClaude(pdfBuffer, apiKey)
  return {
    rawText: ocrText,
    method: 'ocr_vision',
  }
}

async function tryNativeExtraction(pdfBuffer: Buffer): Promise<string | null> {
  try {
    // Import inner module directly — pdf-parse/index.js has a debug check
    // (!module.parent) that tries to read a test PDF when bundled by Next.js
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse')
    const result = await pdfParse(pdfBuffer)
    return result.text || null
  } catch (err) {
    console.error('[extract] pdf-parse failed:', err)
    return null
  }
}

async function extractWithClaude(pdfBuffer: Buffer, apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBuffer.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Extract ALL text content from this purchase order document. Preserve the structure as much as possible — include headers, line items, totals, addresses, and any reference numbers. Return the raw text only, no commentary.',
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock?.text || ''
}
