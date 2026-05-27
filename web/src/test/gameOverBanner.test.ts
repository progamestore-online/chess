import { describe, it, expect } from 'vitest'
import type { GameStatus } from '../types.ts'

function getTitle(status: GameStatus, playerLost: boolean): string {
  if (status === 'playing') return ''
  if (status === 'checkmate') return playerLost ? 'Checkmate — You Lost' : 'Checkmate — You Won!'
  if (status === 'stalemate') return 'Stalemate — Draw'
  if (status === 'draw') return 'Draw'
  if (status === 'resigned') return playerLost ? 'You Resigned' : 'Opponent Resigned'
  return ''
}

function getStyle(status: GameStatus, playerLost: boolean): 'win' | 'loss' | 'neutral' | 'hidden' {
  if (status === 'playing') return 'hidden'
  if (playerLost) return 'loss'
  if (status === 'stalemate' || status === 'draw') return 'neutral'
  return 'win'
}

describe('GameOverBanner logic', () => {
  it('hidden when playing', () => {
    expect(getTitle('playing', false)).toBe('')
    expect(getStyle('playing', false)).toBe('hidden')
  })

  it('checkmate win', () => {
    expect(getTitle('checkmate', false)).toBe('Checkmate — You Won!')
    expect(getStyle('checkmate', false)).toBe('win')
  })

  it('checkmate loss', () => {
    expect(getTitle('checkmate', true)).toBe('Checkmate — You Lost')
    expect(getStyle('checkmate', true)).toBe('loss')
  })

  it('stalemate is neutral', () => {
    expect(getTitle('stalemate', false)).toBe('Stalemate — Draw')
    expect(getStyle('stalemate', false)).toBe('neutral')
  })

  it('stalemate with playerLost=true still shows loss style', () => {
    expect(getStyle('stalemate', true)).toBe('loss')
  })

  it('draw is neutral', () => {
    expect(getTitle('draw', false)).toBe('Draw')
    expect(getStyle('draw', false)).toBe('neutral')
  })

  it('resigned as loser', () => {
    expect(getTitle('resigned', true)).toBe('You Resigned')
    expect(getStyle('resigned', true)).toBe('loss')
  })

  it('resigned as winner', () => {
    expect(getTitle('resigned', false)).toBe('Opponent Resigned')
    expect(getStyle('resigned', false)).toBe('win')
  })
})
