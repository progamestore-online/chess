import { describe, it, expect } from 'vitest'

function deductTime(
  clockW: number, clockB: number,
  lastMoveAt: number, now: number,
  turn: 'w' | 'b', increment: number,
): { clockW: number; clockB: number } {
  if (lastMoveAt <= 0) return { clockW, clockB }
  const elapsed = now - lastMoveAt
  const prevTurn = turn === 'w' ? 'b' : 'w'
  if (prevTurn === 'w') {
    clockW = Math.max(0, clockW - elapsed) + increment
  } else {
    clockB = Math.max(0, clockB - elapsed) + increment
  }
  return { clockW, clockB }
}

function getClocks(
  clockW: number, clockB: number,
  lastMoveAt: number, now: number,
  turn: 'w' | 'b', gameOver: boolean, moveCount: number,
): { w: number; b: number; running: boolean } {
  const elapsed = lastMoveAt > 0 && !gameOver ? now - lastMoveAt : 0
  return {
    w: turn === 'w' ? Math.max(0, clockW - elapsed) : clockW,
    b: turn === 'b' ? Math.max(0, clockB - elapsed) : clockB,
    running: !gameOver && moveCount > 0,
  }
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

describe('time deduction', () => {
  it('deducts from white after black moves', () => {
    const result = deductTime(300, 300, 100, 110, 'w', 0)
    expect(result.clockB).toBe(290)
    expect(result.clockW).toBe(300)
  })

  it('deducts from black after white moves', () => {
    const result = deductTime(300, 300, 100, 115, 'b', 0)
    expect(result.clockW).toBe(285)
    expect(result.clockB).toBe(300)
  })

  it('adds increment after deduction', () => {
    const result = deductTime(300, 300, 100, 110, 'w', 5)
    expect(result.clockB).toBe(295)
  })

  it('clock cannot go below zero', () => {
    const result = deductTime(300, 5, 100, 200, 'w', 0)
    expect(result.clockB).toBe(0)
  })

  it('increment can bring clock above initial after near-zero', () => {
    const result = deductTime(300, 1, 100, 100.5, 'w', 3)
    expect(result.clockB).toBeCloseTo(3.5, 1)
  })

  it('no deduction when lastMoveAt is 0', () => {
    const result = deductTime(300, 300, 0, 110, 'w', 5)
    expect(result.clockW).toBe(300)
    expect(result.clockB).toBe(300)
  })
})

describe('getClocks (live display)', () => {
  it('deducts elapsed from active player', () => {
    const clocks = getClocks(300, 300, 100, 105, 'w', false, 2)
    expect(clocks.w).toBe(295)
    expect(clocks.b).toBe(300)
    expect(clocks.running).toBe(true)
  })

  it('does not deduct when game is over', () => {
    const clocks = getClocks(300, 300, 100, 200, 'w', true, 10)
    expect(clocks.w).toBe(300)
    expect(clocks.running).toBe(false)
  })

  it('does not deduct when no moves played', () => {
    const clocks = getClocks(300, 300, 0, 200, 'w', false, 0)
    expect(clocks.w).toBe(300)
    expect(clocks.running).toBe(false)
  })

  it('active clock floors at zero', () => {
    const clocks = getClocks(10, 300, 100, 200, 'w', false, 2)
    expect(clocks.w).toBe(0)
  })
})

describe('formatClock', () => {
  it('formats 300 seconds as 5:00', () => {
    expect(formatClock(300)).toBe('5:00')
  })

  it('formats 0 seconds as 0:00', () => {
    expect(formatClock(0)).toBe('0:00')
  })

  it('formats 65 seconds as 1:05', () => {
    expect(formatClock(65)).toBe('1:05')
  })

  it('formats 599.9 seconds as 9:59', () => {
    expect(formatClock(599.9)).toBe('9:59')
  })

  it('formats 3600 seconds as 60:00', () => {
    expect(formatClock(3600)).toBe('60:00')
  })
})
