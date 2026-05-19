import { Chess, type Square } from 'chess.js'
import type { MoveAnalysis, GameStatus } from '../types.ts'

export const SAVE_KEY = 'chess.singleplayer.game'

export interface SavedGame {
  pgn: string
  analyses: Record<number, MoveAnalysis>
  gameStatus: GameStatus
  playerColor: 'w' | 'b'
  savedAt: number
}

export interface InitialPlayState {
  chess: Chess
  fen: string
  lastMove: { from: Square; to: Square } | null
  analyses: Record<number, MoveAnalysis>
  gameStatus: GameStatus
}

export function loadSavedGame(): SavedGame | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedGame
    if (typeof parsed.pgn !== 'string') return null
    if (parsed.playerColor !== 'w' && parsed.playerColor !== 'b') return null
    return parsed
  } catch {
    return null
  }
}

// Reconstruct a chess game from a saved PGN. Returns a fresh game if the save is missing,
// for a different color, empty, or corrupt — restoration must never block starting a new game.
export function computeInitialPlayState(playerColor: 'w' | 'b'): InitialPlayState {
  const c = new Chess()
  const saved = loadSavedGame()
  if (saved && saved.playerColor === playerColor && saved.pgn.trim().length > 0) {
    try {
      c.loadPgn(saved.pgn)
      const moves = c.history({ verbose: true })
      const last = moves[moves.length - 1]
      return {
        chess: c,
        fen: c.fen(),
        lastMove: last ? { from: last.from as Square, to: last.to as Square } : null,
        analyses: saved.analyses ?? {},
        gameStatus: saved.gameStatus ?? 'playing',
      }
    } catch {
      // Corrupt PGN — fall through to a fresh game
    }
  }
  return { chess: c, fen: c.fen(), lastMove: null, analyses: {}, gameStatus: 'playing' }
}

export function persistPlayState(args: {
  chess: Chess
  analyses: Record<number, MoveAnalysis>
  gameStatus: GameStatus
  playerColor: 'w' | 'b'
}): void {
  try {
    if (args.chess.history().length === 0 && args.gameStatus === 'playing') {
      localStorage.removeItem(SAVE_KEY)
      return
    }
    const payload: SavedGame = {
      pgn: args.chess.pgn(),
      analyses: args.analyses,
      gameStatus: args.gameStatus,
      playerColor: args.playerColor,
      savedAt: Date.now(),
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
  } catch {
    // Quota exceeded or storage unavailable — non-fatal
  }
}
