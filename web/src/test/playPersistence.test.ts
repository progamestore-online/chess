import { describe, it, expect, beforeEach } from 'vitest'
import { Chess } from 'chess.js'
import {
  SAVE_KEY,
  loadSavedGame,
  computeInitialPlayState,
  persistPlayState,
} from '../services/playPersistence.ts'
import type { MoveAnalysis } from '../types.ts'

describe('playPersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns a fresh game when nothing is saved', () => {
    const init = computeInitialPlayState('w')
    expect(init.chess.history()).toEqual([])
    expect(init.fen).toBe(new Chess().fen())
    expect(init.lastMove).toBeNull()
    expect(init.analyses).toEqual({})
    expect(init.gameStatus).toBe('playing')
  })

  it('round-trips a game through save and restore', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    chess.move('Nf3')
    const analyses: Record<number, MoveAnalysis> = {
      0: {
        move: 'e4',
        category: 'good',
        explanation: 'Strong central pawn',
        bestMove: 'e4',
        evalBefore: 0,
        evalAfter: 30,
      } as MoveAnalysis,
    }

    persistPlayState({ chess, analyses, gameStatus: 'playing', playerColor: 'w' })

    const init = computeInitialPlayState('w')
    expect(init.chess.history()).toEqual(['e4', 'e5', 'Nf3'])
    expect(init.lastMove).toEqual({ from: 'g1', to: 'f3' })
    expect(init.analyses[0]?.move).toBe('e4')
    expect(init.gameStatus).toBe('playing')
  })

  it('ignores saves for a different player color', () => {
    const chess = new Chess()
    chess.move('e4')
    persistPlayState({ chess, analyses: {}, gameStatus: 'playing', playerColor: 'w' })

    const init = computeInitialPlayState('b')
    expect(init.chess.history()).toEqual([])
  })

  it('clears storage when game has no moves and is still playing', () => {
    localStorage.setItem(SAVE_KEY, 'leftover')
    const chess = new Chess()
    persistPlayState({ chess, analyses: {}, gameStatus: 'playing', playerColor: 'w' })
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  })

  it('persists final state when the game is over with no moves (e.g. resign on move 1 is impossible, but checkmate states should survive)', () => {
    const chess = new Chess()
    chess.move('f3')
    chess.move('e5')
    chess.move('g4')
    chess.move('Qh4#')
    expect(chess.isCheckmate()).toBe(true)

    persistPlayState({ chess, analyses: {}, gameStatus: 'checkmate', playerColor: 'w' })
    const init = computeInitialPlayState('w')
    expect(init.gameStatus).toBe('checkmate')
    expect(init.chess.isCheckmate()).toBe(true)
  })

  it('falls back to a fresh game when the saved PGN is corrupt', () => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ pgn: 'garbage not pgn 99. Zz9', analyses: {}, gameStatus: 'playing', playerColor: 'w', savedAt: 0 }),
    )
    const init = computeInitialPlayState('w')
    expect(init.chess.history()).toEqual([])
  })

  it('returns null from loadSavedGame on invalid JSON', () => {
    localStorage.setItem(SAVE_KEY, '{not json')
    expect(loadSavedGame()).toBeNull()
  })

  it('returns null from loadSavedGame when shape is wrong', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ pgn: 'x', playerColor: 'green', analyses: {}, gameStatus: 'playing', savedAt: 0 }))
    expect(loadSavedGame()).toBeNull()
  })
})
