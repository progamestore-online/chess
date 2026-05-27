import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMultiGame } from '../hooks/useMultiGame.ts'
import type { GameSlot } from '../types.ts'

function makeSlot(roomId: string, overrides?: Partial<GameSlot>): GameSlot {
  return {
    roomId,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    yourColor: 'w',
    opponentName: `Opp-${roomId}`,
    opponentAvatar: '',
    isYourTurn: true,
    gameOver: false,
    ...overrides,
  }
}

describe('game switching behavior', () => {
  beforeEach(() => localStorage.clear())

  it('switching to a game updates activeGameId without modifying other games', () => {
    const { result } = renderHook(() => useMultiGame())

    act(() => {
      result.current.addGame(makeSlot('game1'))
      result.current.addGame(makeSlot('game2'))
      result.current.addGame(makeSlot('game3'))
    })

    expect(result.current.activeGameId).toBe('game3')

    act(() => result.current.switchTo('game1'))
    expect(result.current.activeGameId).toBe('game1')
    expect(result.current.games).toHaveLength(3)
  })

  it('updating one game does not affect others', () => {
    const { result } = renderHook(() => useMultiGame())

    act(() => {
      result.current.addGame(makeSlot('game1'))
      result.current.addGame(makeSlot('game2'))
    })

    act(() => {
      result.current.updateGame('game1', {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        isYourTurn: false,
      })
    })

    expect(result.current.games[0].fen).toContain('4P3')
    expect(result.current.games[1].fen).toContain('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')
  })

  it('removing active game clears activeGameId', () => {
    const { result } = renderHook(() => useMultiGame())

    act(() => {
      result.current.addGame(makeSlot('game1'))
      result.current.addGame(makeSlot('game2'))
      result.current.switchTo('game2')
    })

    act(() => result.current.removeGame('game2'))

    expect(result.current.activeGameId).toBeNull()
    expect(result.current.games).toHaveLength(1)
    expect(result.current.games[0].roomId).toBe('game1')
  })

  it('removing non-active game keeps activeGameId', () => {
    const { result } = renderHook(() => useMultiGame())

    act(() => {
      result.current.addGame(makeSlot('game1'))
      result.current.addGame(makeSlot('game2'))
      result.current.switchTo('game2')
    })

    act(() => result.current.removeGame('game1'))

    expect(result.current.activeGameId).toBe('game2')
    expect(result.current.games).toHaveLength(1)
  })

  it('game over state is preserved per-game', () => {
    const { result } = renderHook(() => useMultiGame())

    act(() => {
      result.current.addGame(makeSlot('game1'))
      result.current.addGame(makeSlot('game2'))
    })

    act(() => result.current.updateGame('game1', { gameOver: true }))

    expect(result.current.games[0].gameOver).toBe(true)
    expect(result.current.games[1].gameOver).toBe(false)
  })

  it('persists across localStorage round-trip', () => {
    const { result, unmount } = renderHook(() => useMultiGame())

    act(() => {
      result.current.addGame(makeSlot('game1', { opponentName: 'Alice' }))
      result.current.addGame(makeSlot('game2', { opponentName: 'Bob' }))
    })

    unmount()

    const { result: restored } = renderHook(() => useMultiGame())
    expect(restored.current.games).toHaveLength(2)
    expect(restored.current.games[0].opponentName).toBe('Alice')
    expect(restored.current.games[1].opponentName).toBe('Bob')
  })
})
