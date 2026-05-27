import { describe, it, expect } from 'vitest'

function sanitizeWinner(raw: unknown): 'w' | 'b' | null {
  return raw === 'w' || raw === 'b' ? raw : null
}

function sanitizeReason(raw: unknown): string {
  return typeof raw === 'string' ? raw : 'unknown'
}

function sanitizeMoveCount(raw: unknown): number {
  return typeof raw === 'number' && raw >= 0 ? raw : 0
}

function clampLimit(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : 20
  return Math.max(1, Math.min(n, 50))
}

function collectStaleChallenges(
  challenges: Map<string, { from: { id: string }; to: string }>,
  disconnectedUserId: string,
): string[] {
  return [...challenges.entries()]
    .filter(([, c]) => c.from.id === disconnectedUserId || c.to === disconnectedUserId)
    .map(([id]) => id)
}

describe('LobbyDO: input sanitization', () => {
  describe('sanitizeWinner', () => {
    it('accepts "w"', () => expect(sanitizeWinner('w')).toBe('w'))
    it('accepts "b"', () => expect(sanitizeWinner('b')).toBe('b'))
    it('normalizes null to null', () => expect(sanitizeWinner(null)).toBeNull())
    it('normalizes undefined to null', () => expect(sanitizeWinner(undefined)).toBeNull())
    it('normalizes random string to null', () => expect(sanitizeWinner('white')).toBeNull())
    it('normalizes number to null', () => expect(sanitizeWinner(1)).toBeNull())
    it('normalizes empty string to null', () => expect(sanitizeWinner('')).toBeNull())
  })

  describe('sanitizeReason', () => {
    it('passes through valid string', () => expect(sanitizeReason('checkmate')).toBe('checkmate'))
    it('defaults undefined to "unknown"', () => expect(sanitizeReason(undefined)).toBe('unknown'))
    it('defaults number to "unknown"', () => expect(sanitizeReason(42)).toBe('unknown'))
    it('defaults null to "unknown"', () => expect(sanitizeReason(null)).toBe('unknown'))
  })

  describe('sanitizeMoveCount', () => {
    it('passes through positive number', () => expect(sanitizeMoveCount(24)).toBe(24))
    it('passes through zero', () => expect(sanitizeMoveCount(0)).toBe(0))
    it('clamps negative to zero', () => expect(sanitizeMoveCount(-5)).toBe(0))
    it('defaults undefined to zero', () => expect(sanitizeMoveCount(undefined)).toBe(0))
    it('defaults string to zero', () => expect(sanitizeMoveCount('24')).toBe(0))
  })

  describe('clampLimit', () => {
    it('passes through normal value', () => expect(clampLimit(20)).toBe(20))
    it('clamps to max 50', () => expect(clampLimit(100)).toBe(50))
    it('clamps to min 1', () => expect(clampLimit(0)).toBe(1))
    it('clamps negative to 1', () => expect(clampLimit(-10)).toBe(1))
    it('defaults non-number to 20', () => expect(clampLimit('abc')).toBe(20))
    it('defaults undefined to 20', () => expect(clampLimit(undefined)).toBe(20))
  })
})

describe('LobbyDO: challenge cleanup on disconnect', () => {
  it('collects challenges where user is the challenger', () => {
    const challenges = new Map([
      ['ch1', { from: { id: 'alice' }, to: 'bob' }],
      ['ch2', { from: { id: 'carol' }, to: 'alice' }],
      ['ch3', { from: { id: 'dave' }, to: 'eve' }],
    ])
    const stale = collectStaleChallenges(challenges, 'alice')
    expect(stale).toContain('ch1')
    expect(stale).toContain('ch2')
    expect(stale).not.toContain('ch3')
  })

  it('collects challenges where user is the target', () => {
    const challenges = new Map([
      ['ch1', { from: { id: 'bob' }, to: 'alice' }],
    ])
    expect(collectStaleChallenges(challenges, 'alice')).toEqual(['ch1'])
  })

  it('returns empty for unrelated user', () => {
    const challenges = new Map([
      ['ch1', { from: { id: 'bob' }, to: 'carol' }],
    ])
    expect(collectStaleChallenges(challenges, 'alice')).toEqual([])
  })

  it('returns empty for empty map', () => {
    expect(collectStaleChallenges(new Map(), 'alice')).toEqual([])
  })
})
