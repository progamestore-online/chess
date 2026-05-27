import { describe, it, expect } from 'vitest'

function buildMoveEntries(history: string[]): Array<{ moveNum: number; white: string; black?: string }> {
  const entries: Array<{ moveNum: number; white: string; black?: string }> = []
  for (let i = 0; i < history.length; i += 2) {
    entries.push({
      moveNum: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1],
    })
  }
  return entries
}

describe('MoveList entry building', () => {
  it('empty history produces no entries', () => {
    expect(buildMoveEntries([])).toEqual([])
  })

  it('single move (white only)', () => {
    const entries = buildMoveEntries(['e4'])
    expect(entries).toEqual([{ moveNum: 1, white: 'e4', black: undefined }])
  })

  it('full move pair', () => {
    const entries = buildMoveEntries(['e4', 'e5'])
    expect(entries).toEqual([{ moveNum: 1, white: 'e4', black: 'e5' }])
  })

  it('multiple moves', () => {
    const entries = buildMoveEntries(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])
    expect(entries).toHaveLength(3)
    expect(entries[0]).toEqual({ moveNum: 1, white: 'e4', black: 'e5' })
    expect(entries[1]).toEqual({ moveNum: 2, white: 'Nf3', black: 'Nc6' })
    expect(entries[2]).toEqual({ moveNum: 3, white: 'Bb5', black: undefined })
  })

  it('move numbers are sequential starting at 1', () => {
    const entries = buildMoveEntries(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'])
    expect(entries.map(e => e.moveNum)).toEqual([1, 2, 3, 4])
  })

  it('long game has correct last entry', () => {
    const moves = Array.from({ length: 20 }, (_, i) => `m${i}`)
    const entries = buildMoveEntries(moves)
    expect(entries).toHaveLength(10)
    expect(entries[9]).toEqual({ moveNum: 10, white: 'm18', black: 'm19' })
  })
})

describe('MoveList review index mapping', () => {
  it('clicking white move returns even index', () => {
    const history = ['e4', 'e5', 'Nf3', 'Nc6']
    const whiteIndices = history.map((_, i) => i).filter(i => i % 2 === 0)
    expect(whiteIndices).toEqual([0, 2])
  })

  it('clicking black move returns odd index', () => {
    const history = ['e4', 'e5', 'Nf3', 'Nc6']
    const blackIndices = history.map((_, i) => i).filter(i => i % 2 === 1)
    expect(blackIndices).toEqual([1, 3])
  })
})
