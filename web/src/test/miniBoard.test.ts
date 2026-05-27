import { describe, it, expect } from 'vitest'

function parseFenRows(fen: string): string[][] | null {
  const board = (fen || '').split(' ')[0] || ''
  const rows = board.split('/')
  if (rows.length !== 8) return null
  return rows.map(row => {
    const cells: string[] = []
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < parseInt(ch); i++) cells.push('')
      } else {
        cells.push(ch)
      }
    }
    return cells
  })
}

describe('MiniBoard FEN parsing', () => {
  it('parses starting position correctly', () => {
    const rows = parseFenRows('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(rows).not.toBeNull()
    expect(rows!).toHaveLength(8)
    expect(rows![0]).toEqual(['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'])
    expect(rows![2]).toEqual(['', '', '', '', '', '', '', ''])
    expect(rows![7]).toEqual(['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'])
  })

  it('parses position after e4', () => {
    const rows = parseFenRows('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
    expect(rows).not.toBeNull()
    expect(rows![4][4]).toBe('P')
    expect(rows![6][4]).toBe('')
  })

  it('returns null for empty string', () => {
    expect(parseFenRows('')).toBeNull()
  })

  it('returns null for invalid FEN without 8 rows', () => {
    expect(parseFenRows('rnbqkbnr/pppppppp')).toBeNull()
  })

  it('returns null for undefined-like input', () => {
    expect(parseFenRows(undefined as unknown as string)).toBeNull()
  })

  it('handles FEN with no space (board only)', () => {
    const rows = parseFenRows('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')
    expect(rows).not.toBeNull()
    expect(rows!).toHaveLength(8)
  })

  it('each row has exactly 8 cells', () => {
    const rows = parseFenRows('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1')
    expect(rows).not.toBeNull()
    for (const row of rows!) {
      expect(row).toHaveLength(8)
    }
  })
})
