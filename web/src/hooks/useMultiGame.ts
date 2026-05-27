import { useCallback, useEffect, useState } from 'react'
import type { GameSlot } from '../types.ts'

const STORAGE_KEY = 'chess-active-games'

function loadGames(): GameSlot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as GameSlot[]
  } catch {
    return []
  }
}

function saveGames(games: GameSlot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games))
}

export interface UseMultiGameResult {
  games: GameSlot[]
  activeGameId: string | null
  switchTo: (roomId: string) => void
  addGame: (slot: GameSlot) => void
  removeGame: (roomId: string) => void
  updateGame: (roomId: string, updates: Partial<GameSlot>) => void
  setActiveGameId: (id: string | null) => void
}

export function useMultiGame(): UseMultiGameResult {
  const [games, setGames] = useState<GameSlot[]>(loadGames)
  const [activeGameId, setActiveGameId] = useState<string | null>(null)

  useEffect(() => {
    saveGames(games)
  }, [games])

  const switchTo = useCallback((roomId: string) => {
    setActiveGameId(roomId)
  }, [])

  const addGame = useCallback((slot: GameSlot) => {
    setGames(prev => {
      if (prev.some(g => g.roomId === slot.roomId)) return prev
      return [...prev, slot]
    })
    setActiveGameId(slot.roomId)
  }, [])

  const removeGame = useCallback((roomId: string) => {
    setGames(prev => prev.filter(g => g.roomId !== roomId))
    setActiveGameId(prev => prev === roomId ? null : prev)
  }, [])

  const updateGame = useCallback((roomId: string, updates: Partial<GameSlot>) => {
    setGames(prev => prev.map(g => g.roomId === roomId ? { ...g, ...updates } : g))
  }, [])

  return { games, activeGameId, switchTo, addGame, removeGame, updateGame, setActiveGameId }
}
