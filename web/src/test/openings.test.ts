import { describe, it, expect } from 'vitest'
import { findOpening } from '../services/openings.ts'

describe('findOpening', () => {
  it('returns null for empty history', () => {
    expect(findOpening([])).toBe(null)
  })

  it('names first-move openings', () => {
    expect(findOpening(['e4'])).toBe("King's Pawn")
    expect(findOpening(['d4'])).toBe("Queen's Pawn")
    expect(findOpening(['c4'])).toBe('English Opening')
    expect(findOpening(['Nf3'])).toBe("Zukertort / King's Indian Attack")
  })

  it('returns longest match', () => {
    // 1.e4 e5 → "Open Game"
    expect(findOpening(['e4', 'e5'])).toBe("Open Game (King's Pawn)")
    // 1.e4 e5 2.Nf3 → falls back to longest prefix "e4 e5" (Open Game)
    expect(findOpening(['e4', 'e5', 'Nf3'])).toBe("Open Game (King's Pawn)")
    // 1.e4 e5 2.Nf3 Nc6 → "King's Knight Opening"
    expect(findOpening(['e4', 'e5', 'Nf3', 'Nc6'])).toBe("King's Knight Opening")
    // ...3.Bc4 → "Italian Game"
    expect(findOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])).toBe('Italian Game')
    // ...3.Bb5 → "Ruy López"
    expect(findOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])).toBe('Ruy López (Spanish)')
    // ...3.Bb5 a6 4.Ba4 → "Morphy Defense"
    expect(findOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'])).toBe('Ruy López, Morphy Defense')
  })

  it('handles Sicilian variations', () => {
    expect(findOpening(['e4', 'c5'])).toBe('Sicilian Defense')
    expect(findOpening(['e4', 'c5', 'Nc3'])).toBe('Sicilian, Closed')
    expect(findOpening(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6']))
      .toBe('Sicilian, Najdorf')
  })

  it('handles Queen-side openings', () => {
    expect(findOpening(['d4', 'd5'])).toBe('Closed Game')
    expect(findOpening(['d4', 'd5', 'c4'])).toBe("Queen's Gambit")
    expect(findOpening(['d4', 'd5', 'c4', 'e6'])).toBe('Queen’s Gambit Declined')
    expect(findOpening(['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'])).toBe('Nimzo-Indian')
  })

  it('returns null when no opening matches', () => {
    // Unusual first move not in table
    expect(findOpening(['a3'])).toBe(null)
    expect(findOpening(['h3'])).toBe(null)
  })
})
