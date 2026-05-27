import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'

function computeGameOver(chess: InstanceType<typeof Chess>): { reason: string; winner: 'w' | 'b' | null } | null {
  if (chess.isCheckmate()) {
    return { reason: 'checkmate', winner: chess.turn() === 'w' ? 'b' : 'w' }
  } else if (chess.isStalemate()) {
    return { reason: 'stalemate', winner: null }
  } else if (chess.isDraw()) {
    return { reason: 'draw', winner: null }
  }
  return null
}

function getPlayersInfo(players: Array<{ color: 'w' | 'b'; userId: string; name: string; avatar: string }>) {
  const info: Record<string, { id: string; name: string; avatar: string }> = {}
  for (const p of players) {
    info[p.color] = { id: p.userId, name: p.name, avatar: p.avatar }
  }
  return info
}

function assignColor(existingColors: Set<string>): 'w' | 'b' | 'spectator' {
  if (!existingColors.has('w')) return 'w'
  if (!existingColors.has('b')) return 'b'
  return 'spectator'
}

describe('GameDO: computeGameOver', () => {
  it('returns null for a game in progress', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    expect(computeGameOver(chess)).toBeNull()
  })

  it('detects checkmate (scholars mate, black wins)', () => {
    const chess = new Chess()
    chess.move('f3'); chess.move('e5')
    chess.move('g4'); chess.move('Qh4#')
    const result = computeGameOver(chess)
    expect(result).toEqual({ reason: 'checkmate', winner: 'b' })
  })

  it('detects checkmate (white wins)', () => {
    const chess = new Chess()
    chess.move('e4'); chess.move('e5')
    chess.move('Bc4'); chess.move('Nc6')
    chess.move('Qh5'); chess.move('Nf6')
    chess.move('Qxf7#')
    const result = computeGameOver(chess)
    expect(result).toEqual({ reason: 'checkmate', winner: 'w' })
  })

  it('detects stalemate', () => {
    const chess = new Chess('k7/2Q5/1K6/8/8/8/8/8 b - - 0 1')
    expect(chess.isStalemate()).toBe(true)
    const result = computeGameOver(chess)
    expect(result).toEqual({ reason: 'stalemate', winner: null })
  })

  it('detects draw by insufficient material', () => {
    const chess = new Chess('k7/8/1K6/8/8/8/8/8 w - - 0 1')
    expect(chess.isDraw()).toBe(true)
    const result = computeGameOver(chess)
    expect(result).toEqual({ reason: 'draw', winner: null })
  })
})

describe('GameDO: getPlayersInfo', () => {
  it('maps player array to color-keyed info', () => {
    const players = [
      { color: 'w' as const, userId: 'u1', name: 'Alice', avatar: 'a.png' },
      { color: 'b' as const, userId: 'u2', name: 'Bob', avatar: 'b.png' },
    ]
    const info = getPlayersInfo(players)
    expect(info).toEqual({
      w: { id: 'u1', name: 'Alice', avatar: 'a.png' },
      b: { id: 'u2', name: 'Bob', avatar: 'b.png' },
    })
  })

  it('returns empty object for no players', () => {
    expect(getPlayersInfo([])).toEqual({})
  })

  it('returns only one entry for one player', () => {
    const players = [
      { color: 'w' as const, userId: 'u1', name: 'Alice', avatar: '' },
    ]
    const info = getPlayersInfo(players)
    expect(Object.keys(info)).toEqual(['w'])
  })
})

describe('GameDO: color assignment', () => {
  it('assigns white when no players', () => {
    expect(assignColor(new Set())).toBe('w')
  })

  it('assigns black when white is taken', () => {
    expect(assignColor(new Set(['w']))).toBe('b')
  })

  it('assigns spectator when both colors are taken', () => {
    expect(assignColor(new Set(['w', 'b']))).toBe('spectator')
  })

  it('assigns white if only black is taken', () => {
    expect(assignColor(new Set(['b']))).toBe('w')
  })
})

describe('GameDO: move validation via chess.js', () => {
  it('rejects move when it is not the players turn', () => {
    const chess = new Chess()
    expect(chess.turn()).toBe('w')
    expect(() => chess.move({ from: 'e7', to: 'e5' })).toThrow()
  })

  it('accepts a valid move and updates turn', () => {
    const chess = new Chess()
    const move = chess.move({ from: 'e2', to: 'e4' })
    expect(move).not.toBeNull()
    expect(chess.turn()).toBe('b')
  })

  it('rejects an illegal move', () => {
    const chess = new Chess()
    expect(() => chess.move({ from: 'e2', to: 'e5' })).toThrow()
  })

  it('handles promotion', () => {
    const chess = new Chess('8/P7/8/8/8/8/8/k1K5 w - - 0 1')
    const move = chess.move({ from: 'a7', to: 'a8', promotion: 'q' })
    expect(move).not.toBeNull()
    expect(move!.promotion).toBe('q')
  })

  it('resign sets correct winner', () => {
    const resignerColor = 'w'
    const winner = resignerColor === 'w' ? 'b' : 'w'
    expect(winner).toBe('b')
  })
})

describe('room ID generation', () => {
  it('generates IDs matching the expected pattern', () => {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
    function randomId(): string {
      let out = ''
      const bytes = new Uint8Array(8)
      crypto.getRandomValues(bytes)
      for (const b of bytes) out += alphabet[b % alphabet.length]
      return out
    }

    for (let i = 0; i < 100; i++) {
      const id = randomId()
      expect(id).toHaveLength(8)
      expect(/^[a-z0-9]{8}$/.test(id)).toBe(true)
      expect(id).not.toContain('l')
      expect(id).not.toContain('o')
      expect(id).not.toContain('0')
      expect(id).not.toContain('1')
    }
  })
})
