import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import { parseVoiceMove } from '../services/voiceMoves.ts'

describe('parseVoiceMove', () => {
  it('parses direct SAN moves', () => {
    const c = new Chess()
    expect(parseVoiceMove('e4', c)).toBe('e4')
    expect(parseVoiceMove('Nf3', c)).toBe('Nf3')
  })

  it('parses piece-to-square phrases', () => {
    const c = new Chess()
    expect(parseVoiceMove('knight to f3', c)).toBe('Nf3')
    expect(parseVoiceMove('pawn e4', c)).toBe('e4')
  })

  it('handles kingside castling', () => {
    // Set up a position where O-O is legal: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5
    const c = new Chess()
    for (const move of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']) c.move(move)
    expect(parseVoiceMove('castle kingside', c)).toBe('O-O')
    expect(parseVoiceMove('short castle', c)).toBe('O-O')
  })

  it('returns undo sentinel', () => {
    const c = new Chess()
    expect(parseVoiceMove('undo', c)).toBe('__undo__')
    expect(parseVoiceMove('take back', c)).toBe('__undo__')
  })

  it('returns null on garbage input', () => {
    const c = new Chess()
    expect(parseVoiceMove('zzz qqq', c)).toBe(null)
    expect(parseVoiceMove('', c)).toBe(null)
  })
})
