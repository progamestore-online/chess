import { describe, it, expect } from 'vitest'
import { describeMoveSpoken } from '../services/analysis.ts'

describe('describeMoveSpoken', () => {
  it('narrates simple pawn moves', () => {
    expect(describeMoveSpoken('e4', 'w')).toBe('White pawn to e 4.')
    expect(describeMoveSpoken('d5', 'b')).toBe('Black pawn to d 5.')
  })

  it('narrates piece moves with disambiguation', () => {
    expect(describeMoveSpoken('Nf3', 'w')).toBe('White knight to f 3.')
    expect(describeMoveSpoken('Nbd2', 'w')).toBe('White knight to d 2.')
    expect(describeMoveSpoken('R1e2', 'w')).toBe('White rook to e 2.')
  })

  it('narrates captures', () => {
    expect(describeMoveSpoken('exd5', 'w')).toBe('White pawn takes on d 5.')
    expect(describeMoveSpoken('Nxe4', 'b')).toBe('Black knight takes on e 4.')
  })

  it('narrates castling', () => {
    expect(describeMoveSpoken('O-O', 'w')).toBe('White castles kingside.')
    expect(describeMoveSpoken('O-O-O', 'b')).toBe('Black castles queenside.')
  })

  it('narrates promotions correctly (regression: =Q used to be parsed as target)', () => {
    expect(describeMoveSpoken('e8=Q', 'w')).toBe('White pawn to e 8, promotes to queen.')
    expect(describeMoveSpoken('exd8=Q', 'w')).toBe('White pawn takes on d 8, promotes to queen.')
    expect(describeMoveSpoken('a1=N', 'b')).toBe('Black pawn to a 1, promotes to knight.')
    expect(describeMoveSpoken('exd1=R+', 'b')).toBe('Black pawn takes on d 1, promotes to rook. Check!')
  })

  it('narrates check and checkmate suffixes', () => {
    expect(describeMoveSpoken('Qh5+', 'w')).toBe('White queen to h 5. Check!')
    expect(describeMoveSpoken('Qxf7#', 'w')).toBe('White queen takes on f 7. Checkmate!')
  })
})
