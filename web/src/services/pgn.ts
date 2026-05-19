import type { Chess } from 'chess.js'

interface PgnHeaders {
  event?: string
  white?: string
  black?: string
  result?: string
}

// Serialize the current game as a PGN string with the given headers.
// chess.js's built-in pgn() already produces movetext; we prepend headers manually
// because chess.js's header() API is global+mutating which is awkward to reason about.
export function buildPgn(chess: Chess, headers: PgnHeaders = {}): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
  const fields: Array<[string, string]> = [
    ['Event', headers.event ?? 'Casual game'],
    ['Site', 'chess.progamestore.online'],
    ['Date', date],
    ['White', headers.white ?? 'White'],
    ['Black', headers.black ?? 'Black'],
    ['Result', headers.result ?? '*'],
  ]
  const headerLines = fields.map(([k, v]) => `[${k} "${v.replace(/"/g, "'")}"]`).join('\n')
  // chess.js .pgn() returns just movetext when no headers are set on the instance.
  // Calling with default options gives clean SAN moves.
  const movetext = chess.pgn()
  // movetext may already have a Result token at the end; trust chess.js to format it.
  return `${headerLines}\n\n${movetext}\n`
}

// Try clipboard; fall back to a temporary textarea + execCommand. Resolves true on success.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to fallback
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
