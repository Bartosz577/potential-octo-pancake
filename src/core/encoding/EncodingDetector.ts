import * as iconv from 'iconv-lite'
import type { FileEncoding, EncodingResult } from '../models/types'

// Polish characters in windows-1250 encoding
const WIN1250_POLISH: number[] = [
  0xb9, // ą
  0xa5, // Ą
  0xe6, // ć
  0xc6, // Ć
  0xea, // ę
  0xca, // Ę
  0xb3, // ł
  0xa3, // Ł
  0xf1, // ń
  0xd1, // Ń
  0xf3, // ó
  0xd3, // Ó
  0x9c, // ś
  0x8c, // Ś
  0x9f, // ź
  0x8f, // Ź
  0xbf, // ż
  0xaf  // Ż
]

// Bytes that are invalid in windows-1250
const WIN1250_INVALID: Set<number> = new Set([0x81, 0x83, 0x88, 0x90, 0x98])

/**
 * Check if a buffer contains a valid UTF-8 byte sequence.
 * Returns the number of multi-byte characters found (0 means pure ASCII).
 * Returns -1 if invalid UTF-8 is detected.
 */
function validateUtf8(buffer: Buffer): number {
  let multiByteCount = 0
  let i = 0

  while (i < buffer.length) {
    const byte = buffer[i]

    if (byte <= 0x7f) {
      // ASCII
      i++
      continue
    }

    let expectedContinuation: number
    if ((byte & 0xe0) === 0xc0) {
      expectedContinuation = 1
    } else if ((byte & 0xf0) === 0xe0) {
      expectedContinuation = 2
    } else if ((byte & 0xf8) === 0xf0) {
      expectedContinuation = 3
    } else {
      return -1 // invalid leading byte
    }

    // Check continuation bytes
    for (let j = 1; j <= expectedContinuation; j++) {
      if (i + j >= buffer.length || (buffer[i + j] & 0xc0) !== 0x80) {
        return -1
      }
    }

    multiByteCount++
    i += 1 + expectedContinuation
  }

  return multiByteCount
}

/**
 * Score how likely the buffer is windows-1250 encoded text.
 * Returns a score based on the presence of Polish-specific byte values.
 */
function scoreWindows1250(buffer: Buffer): number {
  let polishCharCount = 0
  let suspiciousCount = 0
  let highByteCount = 0

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i]

    if (byte > 0x7f) {
      highByteCount++

      if (WIN1250_POLISH.includes(byte)) {
        polishCharCount++
      } else if (WIN1250_INVALID.has(byte)) {
        suspiciousCount++
      }
    }
  }

  if (highByteCount === 0) return 0
  if (suspiciousCount > 0) return 0

  return polishCharCount / highByteCount
}

/**
 * Detect the encoding of a buffer.
 *
 * Strategy:
 * 1. Check for BOM (UTF-8 BOM: EF BB BF)
 * 2. Validate as UTF-8 — if valid with multi-byte chars, it's UTF-8
 * 3. If pure ASCII (no high bytes), report UTF-8 with high confidence
 * 4. If invalid UTF-8, score for windows-1250 Polish characters
 * 5. Fallback to windows-1250
 */
export function detectEncoding(buffer: Buffer): EncodingResult {
  if (buffer.length === 0) {
    return { encoding: 'utf-8', confidence: 1.0 }
  }

  // Check UTF-8 BOM
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { encoding: 'utf-8', confidence: 1.0 }
  }

  const utf8Result = validateUtf8(buffer)

  if (utf8Result >= 0) {
    // Valid UTF-8
    if (utf8Result === 0) {
      // Pure ASCII — compatible with everything, call it UTF-8
      return { encoding: 'utf-8', confidence: 0.95 }
    }
    // Multi-byte UTF-8 characters found
    return { encoding: 'utf-8', confidence: 0.99 }
  }

  // Not valid UTF-8 — check windows-1250
  const win1250Score = scoreWindows1250(buffer)
  if (win1250Score > 0.3) {
    return { encoding: 'windows-1250', confidence: 0.8 + win1250Score * 0.15 }
  }

  // Default fallback
  return { encoding: 'windows-1250', confidence: 0.5 }
}

/**
 * Decode a buffer to string using the given encoding.
 */
export function decodeBuffer(buffer: Buffer, encoding: FileEncoding): string {
  // Strip UTF-8 BOM if present
  if (
    encoding === 'utf-8' &&
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    buffer = buffer.subarray(3)
  }

  if (encoding === 'utf-8') {
    return buffer.toString('utf-8')
  }

  return iconv.decode(buffer, encoding)
}

/**
 * Detect encoding and decode buffer to string in one step.
 */
export function autoDecodeBuffer(buffer: Buffer): { text: string; encoding: FileEncoding; confidence: number } {
  const result = detectEncoding(buffer)
  const text = decodeBuffer(buffer, result.encoding)
  return { text, encoding: result.encoding, confidence: result.confidence }
}
