import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMultiGame } from '../hooks/useMultiGame.ts'
import type { GameSlot } from '../types.ts'

const STORAGE_KEY = 'chess-active-games'

function makeSlot(roomId: string, overrides?: Partial<GameSlot>): GameSlot {
  return {
    roomId,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    yourColor: 'w',
    opponentName: `Player-${roomId}`,
    opponentAvatar: '',
    isYourTurn: true,
    gameOver: false,
    ...overrides,
  }
}

describe('useMultiGame', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with no games and no active game', () => {
    const { result } = renderHook(() => useMultiGame())
    expect(result.current.games).toEqual([])
    expect(result.current.activeGameId).toBeNull()
  })

  it('addGame appends a game and makes it active', () => {
    const { result } = renderHook(() => useMultiGame())
    const slot = makeSlot('abc123')

    act(() => result.current.addGame(slot))

    expect(result.current.games).toHaveLength(1)
    expect(result.current.games[0].roomId).toBe('abc123')
    expect(result.current.activeGameId).toBe('abc123')
  })

  it('addGame does not duplicate an existing roomId', () => {
    const { result } = renderHook(() => useMultiGame())
    const slot = makeSlot('abc123')

    act(() => result.current.addGame(slot))
    act(() => result.current.addGame(slot))

    expect(result.current.games).toHaveLength(1)
  })

  it('can add multiple games and switch between them', () => {
    const { result } = renderHook(() => useMultiGame())

    act(() => result.current.addGame(makeSlot('game1')))
    act(() => result.current.addGame(makeSlot('game2')))
    act(() => result.current.addGame(makeSlot('game3')))

    expect(result.current.games).toHaveLength(3)
    expect(result.current.activeGameId).toBe('game3')

    act(() => result.current.switchTo('game1'))
    expect(result.current.activeGameId).toBe('game1')
  })

  it('removeGame removes the game and clears activeGameId if it was active', () => {
    const { result } = renderHook(() => useMultiGame())

    act(() => result.current.addGame(makeSlot('game1')))
    act(() => result.current.addGame(makeSlot('game2')))

    expect(result.current.activeGameId).toBe('game2')

    act(() => result.current.removeGame('game2'))

    expect(result.current.games).toHaveLength(1)
    expect(result.current.games[0].roomId).toBe('game1')
    expect(result.current.activeGameId).toBeNull()
  })

  it('removeGame keeps activeGameId if a different game was removed', () => {
    const { result } = renderHook(() => useMultiGame())

    act(() => result.current.addGame(makeSlot('game1')))
    act(() => result.current.addGame(makeSlot('game2')))
    act(() => result.current.switchTo('game2'))

    act(() => result.current.removeGame('game1'))

    expect(result.current.activeGameId).toBe('game2')
  })

  it('updateGame patches a specific game', () => {
    const { result } = renderHook(() => useMultiGame())

    act(() => result.current.addGame(makeSlot('game1')))

    act(() => result.current.updateGame('game1', {
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      isYourTurn: false,
    }))

    expect(result.current.games[0].fen).toContain('4P3')
    expect(result.current.games[0].isYourTurn).toBe(false)
    expect(result.current.games[0].opponentName).toBe('Player-game1')
  })

  it('updateGame on nonexistent roomId is a no-op', () => {
    const { result } = renderHook(() => useMultiGame())

    act(() => result.current.addGame(makeSlot('game1')))
    act(() => result.current.updateGame('nope', { isYourTurn: false }))

    expect(result.current.games).toHaveLength(1)
    expect(result.current.games[0].isYourTurn).toBe(true)
  })

  it('persists games to localStorage', () => {
    const { result } = renderHook(() => useMultiGame())

    act(() => result.current.addGame(makeSlot('game1')))

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored).toHaveLength(1)
    expect(stored[0].roomId).toBe('game1')
  })

  it('restores games from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([makeSlot('saved1'), makeSlot('saved2')]))

    const { result } = renderHook(() => useMultiGame())

    expect(result.current.games).toHaveLength(2)
    expect(result.current.games[0].roomId).toBe('saved1')
    expect(result.current.games[1].roomId).toBe('saved2')
  })

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')

    const { result } = renderHook(() => useMultiGame())
    expect(result.current.games).toEqual([])
  })

  it('setActiveGameId allows setting to null', () => {
    const { result } = renderHook(() => useMultiGame())

    act(() => result.current.addGame(makeSlot('game1')))
    expect(result.current.activeGameId).toBe('game1')

    act(() => result.current.setActiveGameId(null))
    expect(result.current.activeGameId).toBeNull()
  })
})
