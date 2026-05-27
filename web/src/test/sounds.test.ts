import { describe, it, expect } from 'vitest'

function classifyMoveSound(move: { captured?: string; san?: string }, muted: boolean): string {
  if (muted) return 'silent'
  const san = move.san ?? ''
  if (san.endsWith('#')) return 'checkmate'
  if (san.endsWith('+')) return 'check'
  if (move.captured) return 'capture'
  return 'move'
}

describe('playSoundForMove classification', () => {
  it('silent when muted', () => {
    expect(classifyMoveSound({ san: 'e4' }, true)).toBe('silent')
  })

  it('checkmate sound for SAN ending in #', () => {
    expect(classifyMoveSound({ san: 'Qh4#' }, false)).toBe('checkmate')
  })

  it('check sound for SAN ending in +', () => {
    expect(classifyMoveSound({ san: 'Bb5+' }, false)).toBe('check')
  })

  it('capture sound when move has captured piece', () => {
    expect(classifyMoveSound({ san: 'Nxe5', captured: 'p' }, false)).toBe('capture')
  })

  it('regular move sound for quiet move', () => {
    expect(classifyMoveSound({ san: 'e4' }, false)).toBe('move')
  })

  it('handles missing san gracefully', () => {
    expect(classifyMoveSound({}, false)).toBe('move')
  })

  it('handles undefined san', () => {
    expect(classifyMoveSound({ san: undefined }, false)).toBe('move')
  })

  it('capture with check prioritizes check over capture', () => {
    expect(classifyMoveSound({ san: 'Nxf7+', captured: 'p' }, false)).toBe('check')
  })

  it('capture with checkmate prioritizes checkmate', () => {
    expect(classifyMoveSound({ san: 'Qxf7#', captured: 'p' }, false)).toBe('checkmate')
  })
})
