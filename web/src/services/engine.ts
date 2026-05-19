import { Chess, type Move } from 'chess.js'
import type { Difficulty } from '../types.ts'
import { stockfish } from './stockfish.ts'

// Stockfish skill/depth settings per difficulty
const SF_CONFIG: Record<Difficulty, { skill: number; depth: number }> = {
  1: { skill: 0, depth: 1 },  // not used for SF, but here for completeness
  2: { skill: 3, depth: 5 },  // not used for SF either
  3: { skill: 5, depth: 8 },
  4: { skill: 12, depth: 12 },
  5: { skill: 20, depth: 16 },
}

// Use Stockfish for difficulty 3+ (async), minimax for 1-2 (sync)
export function shouldUseStockfish(difficulty: Difficulty): boolean {
  return difficulty >= 3 && stockfish.ready
}

// Piece values in centipawns
const PIECE_VALUE: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
}

// Piece-square tables (from white's perspective, index 0 = a8)
const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
    0,  0,  0,  0,  0,  0,  0,  0,
    5, 10, 10, 10, 10, 10, 10,  5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
    0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20,
  ],
}

// King endgame table (encourage centralization)
const PST_KING_ENDGAME = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
]

function isEndgame(chess: Chess): boolean {
  const board = chess.board()
  let queens = 0
  let minors = 0
  for (const row of board) {
    for (const sq of row) {
      if (!sq) continue
      if (sq.type === 'q') queens++
      if (sq.type === 'n' || sq.type === 'b') minors++
    }
  }
  return queens === 0 || (queens <= 2 && minors <= 2)
}

function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999
  }
  if (chess.isDraw() || chess.isStalemate()) return 0

  let score = 0
  const endgame = isEndgame(chess)
  const board = chess.board()

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col]
      if (!piece) continue

      const idx = row * 8 + col
      const mirrorIdx = (7 - row) * 8 + col
      const materialValue = PIECE_VALUE[piece.type]

      let pstValue: number
      if (piece.type === 'k' && endgame) {
        pstValue = piece.color === 'w' ? PST_KING_ENDGAME[mirrorIdx] : PST_KING_ENDGAME[idx]
      } else {
        const table = PST[piece.type]
        pstValue = piece.color === 'w' ? table[mirrorIdx] : table[idx]
      }

      const pieceScore = materialValue + pstValue
      score += piece.color === 'w' ? pieceScore : -pieceScore
    }
  }

  return score
}

function orderMoves(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    let scoreA = 0
    let scoreB = 0

    // Captures first (MVV-LVA ordering)
    if (a.captured) scoreA += 10 * PIECE_VALUE[a.captured] - PIECE_VALUE[a.piece]
    if (b.captured) scoreB += 10 * PIECE_VALUE[b.captured] - PIECE_VALUE[b.piece]

    // Promotions
    if (a.promotion) scoreA += PIECE_VALUE[a.promotion]
    if (b.promotion) scoreB += PIECE_VALUE[b.promotion]

    // Checks
    if (a.san.includes('+')) scoreA += 50
    if (b.san.includes('+')) scoreB += 50

    return scoreB - scoreA
  })
}

function alphaBeta(chess: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluate(chess)
  }

  const moves = orderMoves(chess.moves({ verbose: true }))

  if (maximizing) {
    let maxEval = -Infinity
    for (const move of moves) {
      chess.move(move)
      const ev = alphaBeta(chess, depth - 1, alpha, beta, false)
      chess.undo()
      maxEval = Math.max(maxEval, ev)
      alpha = Math.max(alpha, ev)
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (const move of moves) {
      chess.move(move)
      const ev = alphaBeta(chess, depth - 1, alpha, beta, true)
      chess.undo()
      minEval = Math.min(minEval, ev)
      beta = Math.min(beta, ev)
      if (beta <= alpha) break
    }
    return minEval
  }
}

const DEPTH_BY_DIFFICULTY: Record<Difficulty, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5,
}

export function findBestMove(chess: Chess, difficulty: Difficulty): Move | null {
  const moves = chess.moves({ verbose: true })
  if (moves.length === 0) return null

  const depth = DEPTH_BY_DIFFICULTY[difficulty]
  const maximizing = chess.turn() === 'w'

  let bestMove = moves[0]
  let bestEval = maximizing ? -Infinity : Infinity

  const scored: { move: Move; eval: number }[] = []

  for (const move of orderMoves(moves)) {
    chess.move(move)
    const ev = alphaBeta(chess, depth - 1, -Infinity, Infinity, !maximizing)
    chess.undo()

    scored.push({ move, eval: ev })

    if (maximizing) {
      if (ev > bestEval) { bestEval = ev; bestMove = move }
    } else {
      if (ev < bestEval) { bestEval = ev; bestMove = move }
    }
  }

  // Add randomness for lower difficulties
  if (difficulty <= 2) {
    const noise = difficulty === 1 ? 200 : 80
    const withNoise = scored.map(s => ({
      ...s,
      eval: s.eval + (Math.random() - 0.5) * noise,
    }))
    withNoise.sort((a, b) => maximizing ? b.eval - a.eval : a.eval - b.eval)
    bestMove = withNoise[0].move
  }

  return bestMove
}

export function evaluatePosition(chess: Chess): number {
  return evaluate(chess)
}

// --- Stockfish-powered functions (async) ---

export async function findBestMoveSF(chess: Chess, difficulty: Difficulty): Promise<Move | null> {
  const cfg = SF_CONFIG[difficulty]
  await stockfish.setSkillLevel(cfg.skill)

  const uciMove = await stockfish.findBestMove(chess.fen(), cfg.depth)
  if (!uciMove) return null

  // Convert UCI move (e.g. "e2e4") to chess.js Move
  const from = uciMove.slice(0, 2)
  const to = uciMove.slice(2, 4)
  const promotion = uciMove.length > 4 ? uciMove[4] : undefined

  const moves = chess.moves({ verbose: true })
  return moves.find(m => m.from === from && m.to === to && (!promotion || m.promotion === promotion)) ?? null
}

export async function evaluatePositionSF(chess: Chess): Promise<number> {
  const evalResult = await stockfish.evaluate(chess.fen(), 10)
  // Stockfish reports score from the side-to-move's perspective; normalize to white.
  return chess.turn() === 'w' ? evalResult.score : -evalResult.score
}

export async function evaluateMoveSF(
  chessBefore: Chess,
  moveSan: string
): Promise<{ evalBefore: number; evalAfter: number; bestMove: string | null; bestEval: number; punishment: string | null }> {
  // Evaluate position before the move to get best move + eval
  const beforeResult = await stockfish.evaluate(chessBefore.fen(), 10)
  const evalBefore = chessBefore.turn() === 'w' ? beforeResult.score : -beforeResult.score

  // Convert Stockfish's best move from UCI to SAN
  const sfBestUci = beforeResult.bestMove
  let bestMoveSan: string | null = null
  if (sfBestUci) {
    const from = sfBestUci.slice(0, 2)
    const to = sfBestUci.slice(2, 4)
    const promo = sfBestUci.length > 4 ? sfBestUci[4] : undefined
    const legal = chessBefore.moves({ verbose: true })
    const match = legal.find(m => m.from === from && m.to === to && (!promo || m.promotion === promo))
    if (match) bestMoveSan = match.san
  }

  // Evaluate after the player's actual move. afterResult.bestMove is the opponent's
  // best reply — the "punishment" if the player just blundered.
  const cloneActual = new Chess(chessBefore.fen())
  cloneActual.move(moveSan)
  const afterResult = await stockfish.evaluate(cloneActual.fen(), 10)
  const evalAfter = cloneActual.turn() === 'w' ? afterResult.score : -afterResult.score

  let punishment: string | null = null
  if (afterResult.bestMove) {
    const from = afterResult.bestMove.slice(0, 2)
    const to = afterResult.bestMove.slice(2, 4)
    const promo = afterResult.bestMove.length > 4 ? afterResult.bestMove[4] : undefined
    const legal = cloneActual.moves({ verbose: true })
    const match = legal.find(m => m.from === from && m.to === to && (!promo || m.promotion === promo))
    if (match) punishment = match.san
  }

  // Evaluate after the best move (for accurate diff)
  if (bestMoveSan && bestMoveSan !== moveSan) {
    const cloneBest = new Chess(chessBefore.fen())
    cloneBest.move(bestMoveSan)
    const bestResult = await stockfish.evaluate(cloneBest.fen(), 10)
    return {
      evalBefore,
      evalAfter,
      bestMove: bestMoveSan,
      bestEval: cloneBest.turn() === 'w' ? bestResult.score : -bestResult.score,
      punishment,
    }
  }

  return { evalBefore, evalAfter, bestMove: bestMoveSan, bestEval: evalAfter, punishment }
}

// --- Minimax-only functions (sync, for difficulty 1-2) ---

export function evaluateMove(chess: Chess, moveSan: string): { evalBefore: number; evalAfter: number; bestMove: string | null; bestEval: number; punishment: null } {
  const evalBefore = evaluate(chess)

  // Find the best move before this move was made
  const movesBefore = chess.moves({ verbose: true })
  const maximizing = chess.turn() === 'w'
  let bestMove: string | null = null
  let bestEval = maximizing ? -Infinity : Infinity

  for (const m of orderMoves(movesBefore)) {
    chess.move(m)
    const ev = alphaBeta(chess, 2, -Infinity, Infinity, !maximizing)
    chess.undo()
    if (maximizing ? ev > bestEval : ev < bestEval) {
      bestEval = ev
      bestMove = m.san
    }
  }

  // Now make the actual move and evaluate
  chess.move(moveSan)
  const evalAfter = evaluate(chess)
  chess.undo()

  return { evalBefore, evalAfter, bestMove, bestEval, punishment: null }
}
