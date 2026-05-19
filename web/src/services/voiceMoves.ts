import type { Chess } from 'chess.js'

// Parse spoken text into a chess move SAN notation
export function parseVoiceMove(text: string, chess: Chess): string | null {
  const spoken = text.toLowerCase().trim()
  const legalMoves = chess.moves()

  // Direct match: user says exact notation like "e4", "Nf3", "Bb5"
  const directMatch = legalMoves.find(m => m.toLowerCase() === spoken.replace(/\s+/g, ''))
  if (directMatch) return directMatch

  // Handle castling
  if (spoken.match(/\bcastle\s*(king\s*side|short)\b/) || spoken.match(/\bcastles?\s*(king|short)\b/) || spoken === 'castle' || spoken === 'short castle') {
    if (legalMoves.includes('O-O')) return 'O-O'
  }
  if (spoken.match(/\bcastle\s*(queen\s*side|long)\b/) || spoken.match(/\bcastles?\s*(queen|long)\b/) || spoken === 'long castle') {
    if (legalMoves.includes('O-O-O')) return 'O-O-O'
  }

  // Handle "undo" / "take back"
  if (spoken.match(/\b(undo|take\s*back|go\s*back)\b/)) return '__undo__'

  // Handle "resign" / "give up"
  if (spoken.match(/\b(resign|give\s*up|i\s*resign)\b/)) return '__resign__'

  // Handle "new game" / "restart"
  if (spoken.match(/\b(new\s*game|restart|start\s*over|reset)\b/)) return '__new_game__'

  // Piece name mapping
  const pieceMap: Record<string, string> = {
    king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N',
    pawn: '', horse: 'N', tower: 'R', castle: 'R',
  }

  // Parse "piece to square" patterns like "knight to f3", "pawn to e4", "bishop c4"
  const pieceToSquare = spoken.match(
    /\b(king|queen|rook|bishop|knight|pawn|horse|tower)\s*(?:to\s+)?([a-h])\s*([1-8])\b/
  )
  if (pieceToSquare) {
    const piece = pieceMap[pieceToSquare[1]]
    const file = pieceToSquare[2]
    const rank = pieceToSquare[3]
    const target = `${piece}${file}${rank}`

    // Find matching legal move
    const match = legalMoves.find(m => {
      const clean = m.replace(/[+#x]/g, '')
      return clean === target || (piece === '' && clean === `${file}${rank}`)
    })
    if (match) return match
  }

  // Parse "piece takes square" patterns like "knight takes d5"
  const pieceTakes = spoken.match(
    /\b(king|queen|rook|bishop|knight|pawn|horse|tower)\s*(?:takes?|captures?)\s*(?:on\s+)?([a-h])\s*([1-8])\b/
  )
  if (pieceTakes) {
    const piece = pieceMap[pieceTakes[1]]
    const file = pieceTakes[2]
    const rank = pieceTakes[3]

    const match = legalMoves.find(m => {
      return m.includes('x') && m.includes(`${file}${rank}`) && m.startsWith(piece)
    })
    if (match) return match
  }

  // Parse "takes on d5" (no piece specified)
  const takesOn = spoken.match(/\b(?:takes?|captures?)\s*(?:on\s+)?([a-h])\s*([1-8])\b/)
  if (takesOn) {
    const sq = `${takesOn[1]}${takesOn[2]}`
    const match = legalMoves.find(m => m.includes('x') && m.includes(sq))
    if (match) return match
  }

  // Parse plain square references like "e4", "d 5", "a 1"
  const plainSquare = spoken.match(/\b([a-h])\s*([1-8])\b/)
  if (plainSquare) {
    const sq = `${plainSquare[1]}${plainSquare[2]}`
    // First check pawn moves to this square
    const pawnMatch = legalMoves.find(m => {
      const clean = m.replace(/[+#]/g, '')
      return clean === sq || clean === `${sq}=Q` // default promote to queen
    })
    if (pawnMatch) return pawnMatch

    // Then check any piece move to this square
    const anyMatch = legalMoves.find(m => m.includes(sq) && !m.includes('x'))
    if (anyMatch) return anyMatch

    // Captures to this square
    const captureMatch = legalMoves.find(m => m.includes(sq))
    if (captureMatch) return captureMatch
  }

  // Try number-to-letter mapping for speech recognition that hears numbers
  // "e4" sometimes gets heard as "eat for" or "he four"
  const numberWords: Record<string, string> = {
    one: '1', two: '2', too: '2', to: '2', three: '3', four: '4', for: '4',
    five: '5', six: '6', seven: '7', eight: '8',
  }
  const letterSounds: Record<string, string> = {
    hey: 'a', ay: 'a', eh: 'a', bee: 'b', be: 'b', see: 'c', sea: 'c',
    dee: 'd', he: 'e', eat: 'e', ee: 'e', ef: 'f', eff: 'f',
    gee: 'g', ji: 'g', aitch: 'h', age: 'h',
  }

  const words = spoken.split(/\s+/)
  for (let i = 0; i < words.length - 1; i++) {
    const file = letterSounds[words[i]] || (words[i].length === 1 && words[i] >= 'a' && words[i] <= 'h' ? words[i] : null)
    const rank = numberWords[words[i + 1]] || (words[i + 1].length === 1 && words[i + 1] >= '1' && words[i + 1] <= '8' ? words[i + 1] : null)
    if (file && rank) {
      const sq = `${file}${rank}`
      const match = legalMoves.find(m => m.includes(sq))
      if (match) return match
    }
  }

  return null
}
