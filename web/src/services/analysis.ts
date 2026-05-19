import { Chess } from 'chess.js'
import type { MoveAnalysis } from '../types.ts'
import { evaluateMove, evaluateMoveSF, shouldUseStockfish } from './engine.ts'
import type { Difficulty } from '../types.ts'

const PIECE_POINTS: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }
const PIECE_NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

// "Solid move" gets boring fast — vary the praise based on detectable move features.
function goodMoveText(_chess: Chess, moveSan: string, moveObj: { from: string; to: string; piece: string; captured?: string } | undefined): string {
  if (!moveObj) return "Solid move."
  const center = new Set(['d4', 'd5', 'e4', 'e5'])
  const extendedCenter = new Set(['c3', 'c4', 'c5', 'c6', 'd3', 'd6', 'e3', 'e6', 'f3', 'f4', 'f5', 'f6'])

  if (moveObj.captured) {
    const pts = PIECE_POINTS[moveObj.captured] ?? 0
    const name = PIECE_NAMES[moveObj.captured] ?? 'piece'
    return `Captures a ${name} (${pts} point${pts === 1 ? '' : 's'}).`
  }
  if (moveSan === 'O-O') return 'Castles kingside — king safety secured.'
  if (moveSan === 'O-O-O') return 'Castles queenside — king safety secured.'

  // Development: minor piece moves off its home rank
  const fromRank = parseInt(moveObj.from[1])
  const isDevelopment = (moveObj.piece === 'n' || moveObj.piece === 'b') && (fromRank === 1 || fromRank === 8)
  if (isDevelopment) {
    const name = PIECE_NAMES[moveObj.piece]
    return `Develops the ${name}.`
  }

  if (center.has(moveObj.to)) return 'Stakes a claim in the center.'
  if (extendedCenter.has(moveObj.to)) return 'Improves central control.'

  return 'Solid move.'
}

// Brilliant criteria: best move AND a real sacrifice (piece can be captured for less material)
// AND the position is winning. Otherwise just "best move".
function isBrilliantSacrifice(chessBefore: Chess, moveSan: string, evalAfterFromMover: number): boolean {
  if (evalAfterFromMover < 200) return false  // not winning enough to call brilliant
  const clone = new Chess(chessBefore.fen())
  const m = clone.move(moveSan)
  if (!m) return false
  // Did the moving piece land on a square attacked by the opponent?
  // chess.js doesn't expose isAttacked directly — heuristically check if any opponent move targets it.
  const opponentMoves = clone.moves({ verbose: true })
  const attacked = opponentMoves.some(om => om.to === m.to)
  if (!attacked) return false
  // Is there a cheaper attacker than the moved piece?
  const movedValue = PIECE_POINTS[m.piece] ?? 99
  for (const om of opponentMoves) {
    if (om.to !== m.to) continue
    const attackerValue = PIECE_POINTS[om.piece] ?? 99
    if (attackerValue < movedValue) return true
  }
  return false
}

export async function analyzePlayerMove(chess: Chess, moveSan: string, playerColor: 'w' | 'b', difficulty: Difficulty = 2): Promise<MoveAnalysis> {
  const useSF = shouldUseStockfish(difficulty)
  const result = useSF
    ? await evaluateMoveSF(chess, moveSan)
    : evaluateMove(chess, moveSan)
  const { evalAfter, bestMove, bestEval } = result
  const punishment: string | null = useSF ? (result as { punishment: string | null }).punishment : null

  // Calculate evaluation swing from the player's perspective
  const sign = playerColor === 'w' ? 1 : -1
  const moveEval = evalAfter * sign
  const bestMoveEval = bestEval * sign
  const diff = bestMoveEval - moveEval  // how much worse is this move vs best

  const moveObj = chess.moves({ verbose: true }).find(m => m.san === moveSan)

  let category: MoveAnalysis['category']
  let explanation: string

  if (diff <= 0) {
    // Best move. Is it actually brilliant (sacrifice + winning), or just the right move?
    if (isBrilliantSacrifice(chess, moveSan, moveEval)) {
      category = 'brilliant'
      explanation = 'Brilliant! A sacrifice that wins.'
    } else {
      category = 'good'
      explanation = goodMoveText(chess, moveSan, moveObj)
    }
  } else if (diff < 30) {
    category = 'great'
    explanation = 'Great move. Very close to the engine\'s pick.'
  } else if (diff < 80) {
    category = 'good'
    explanation = goodMoveText(chess, moveSan, moveObj)
  } else if (diff < 180) {
    category = 'inaccuracy'
    explanation = bestMove
      ? `An inaccuracy. ${bestMove} was a bit stronger.`
      : 'A small inaccuracy.'
  } else if (diff < 400) {
    category = 'mistake'
    const pawns = Math.round(diff / 100)
    const base = bestMove
      ? `Mistake. ${bestMove} was better — this drops about ${pawns} pawn${pawns === 1 ? '' : 's'}.`
      : `Mistake. This drops about ${pawns} pawn${pawns === 1 ? '' : 's'}.`
    explanation = punishment ? `${base} Opponent's best reply: ${punishment}.` : base
  } else {
    category = 'blunder'
    const base = bestMove
      ? `Blunder! ${bestMove} was the right move.`
      : 'Serious blunder.'
    explanation = punishment ? `${base} Opponent now plays ${punishment} for a winning advantage.` : base
  }

  // Override with checkmate
  const clone = new Chess(chess.fen())
  clone.move(moveSan)

  if (clone.isCheckmate()) {
    category = 'brilliant'
    explanation = 'Checkmate! Beautiful finish.'
  } else if (clone.isCheck() && (category === 'good' || category === 'great')) {
    explanation += ' Check.'
  }

  return {
    move: moveSan,
    evaluation: evalAfter,
    bestMove: bestMove === moveSan ? null : bestMove,
    bestEval,
    category,
    explanation,
  }
}

export function getPositionAdvice(chess: Chess, playerColor: 'w' | 'b'): string {
  if (chess.isCheckmate()) return playerColor === chess.turn() ? "You've been checkmated!" : "Checkmate! You win!"
  if (chess.isDraw()) return "The game is a draw."
  if (chess.isStalemate()) return "Stalemate - it's a draw."
  if (chess.isCheck()) {
    return chess.turn() === playerColor ? "You're in check! You must get out of check." : "Check!"
  }

  const moves = chess.moves({ verbose: true })
  const captures = moves.filter(m => m.captured)
  const checks = moves.filter(m => m.san.includes('+'))

  if (chess.turn() === playerColor) {
    const hints: string[] = []
    if (checks.length > 0) hints.push("You have a check available.")
    if (captures.length > 0) hints.push(`You can capture ${captures.length} piece${captures.length > 1 ? 's' : ''}.`)
    if (moves.length < 10) hints.push("Your pieces are restricted. Try to create more space.")
    if (hints.length === 0) hints.push("Look for ways to improve your piece positions.")
    return hints[0]
  }

  return ""
}

export function describeMoveSpoken(san: string, color: 'w' | 'b'): string {
  const who = color === 'w' ? 'White' : 'Black'

  if (san === 'O-O') return `${who} castles kingside.`
  if (san === 'O-O-O') return `${who} castles queenside.`

  let desc = who + ' '

  // Remove check/checkmate indicators for parsing
  const clean = san.replace(/[+#]/g, '')

  const pieceNames: Record<string, string> = {
    K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight',
  }

  let i = 0
  let piece = 'pawn'

  if (clean[i] && pieceNames[clean[i]]) {
    piece = pieceNames[clean[i]]
    i++
  }

  const isCapture = clean.includes('x')
  // Strip promotion suffix (=Q etc) BEFORE locating the destination square,
  // otherwise pawn capture-promotion like "exd8=Q" treats "=Q" as the target.
  const beforePromo = clean.split('=')[0]
  const parts = beforePromo.slice(i).replace('x', '')

  // Get the destination square (last 2 chars after stripping prefix and 'x')
  const target = parts.slice(-2)

  if (isCapture) {
    desc += `${piece} takes on ${target[0]} ${target[1]}`
  } else {
    desc += `${piece} to ${target[0]} ${target[1]}`
  }

  if (san.includes('=')) {
    const promo = san.split('=')[1]?.replace(/[+#]/, '')
    if (promo && pieceNames[promo]) {
      desc += `, promotes to ${pieceNames[promo]}`
    }
  }

  if (san.includes('#')) return desc + '. Checkmate!'
  if (san.includes('+')) return desc + '. Check!'
  return desc + '.'
}
