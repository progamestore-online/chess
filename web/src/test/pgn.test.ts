import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import { buildPgn } from '../services/pgn.ts'

describe('buildPgn', () => {
  it('emits seven-tag roster + movetext', () => {
    const c = new Chess()
    c.move('e4')
    c.move('e5')
    c.move('Nf3')
    const pgn = buildPgn(c, { event: 'Test game', white: 'Alice', black: 'Bob', result: '*' })

    expect(pgn).toContain('[Event "Test game"]')
    expect(pgn).toContain('[White "Alice"]')
    expect(pgn).toContain('[Black "Bob"]')
    expect(pgn).toContain('[Site "chess.progamestore.online"]')
    expect(pgn).toContain('[Result "*"]')
    expect(pgn).toMatch(/\[Date "\d{4}\.\d{2}\.\d{2}"\]/)
    // Movetext
    expect(pgn).toContain('1. e4 e5 2. Nf3')
  })

  it('escapes double quotes in header values', () => {
    const c = new Chess()
    const pgn = buildPgn(c, { white: 'Said "the king"' })
    expect(pgn).toContain(`[White "Said 'the king'"]`)
  })

  it('uses sensible defaults when headers omitted', () => {
    const c = new Chess()
    const pgn = buildPgn(c)
    expect(pgn).toContain('[Event "Casual game"]')
    expect(pgn).toContain('[White "White"]')
    expect(pgn).toContain('[Black "Black"]')
    expect(pgn).toContain('[Result "*"]')
  })
})
