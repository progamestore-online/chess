import { describe, it, expect } from 'vitest'
import type { OnlineUser, MatchRecord, Challenge } from '../types.ts'

type LobbyServerMsg = {
  type: string
  users?: OnlineUser[]
  user?: OnlineUser
  userId?: string
  challengeId?: string
  from?: OnlineUser
  roomId?: string
  matches?: MatchRecord[]
}

function applyPresenceMessage(
  current: OnlineUser[],
  msg: LobbyServerMsg,
): OnlineUser[] {
  switch (msg.type) {
    case 'presence':
      return msg.users ?? []
    case 'user_joined':
      if (msg.user) return [...current.filter(u => u.id !== msg.user!.id), msg.user]
      return current
    case 'user_left':
      if (msg.userId) return current.filter(u => u.id !== msg.userId)
      return current
    default:
      return current
  }
}

function applyChallengeMessage(
  current: Challenge[],
  msg: LobbyServerMsg,
): Challenge[] {
  switch (msg.type) {
    case 'challenge_incoming':
      if (msg.challengeId && msg.from) {
        return [...current, { id: msg.challengeId, from: msg.from, createdAt: Date.now() }]
      }
      return current
    case 'challenge_accepted':
      return current.filter(c => c.id !== msg.challengeId)
    case 'challenge_declined':
      return current.filter(c => c.id !== msg.challengeId)
    default:
      return current
  }
}

const alice: OnlineUser = { id: 'a1', name: 'Alice', avatar: 'a.png', connectedAt: '2026-01-01T00:00:00Z' }
const bob: OnlineUser = { id: 'b2', name: 'Bob', avatar: 'b.png', connectedAt: '2026-01-01T00:01:00Z' }
const carol: OnlineUser = { id: 'c3', name: 'Carol', avatar: 'c.png', connectedAt: '2026-01-01T00:02:00Z' }

describe('lobby presence message handling', () => {
  it('sets initial user list from presence message', () => {
    const result = applyPresenceMessage([], { type: 'presence', users: [alice, bob] })
    expect(result).toEqual([alice, bob])
  })

  it('adds a user on user_joined', () => {
    const result = applyPresenceMessage([alice], { type: 'user_joined', user: bob })
    expect(result).toHaveLength(2)
    expect(result[1]).toEqual(bob)
  })

  it('deduplicates on user_joined if user already in list', () => {
    const result = applyPresenceMessage([alice, bob], { type: 'user_joined', user: alice })
    expect(result).toHaveLength(2)
    const aliceEntries = result.filter(u => u.id === 'a1')
    expect(aliceEntries).toHaveLength(1)
  })

  it('removes a user on user_left', () => {
    const result = applyPresenceMessage([alice, bob, carol], { type: 'user_left', userId: 'b2' })
    expect(result).toHaveLength(2)
    expect(result.find(u => u.id === 'b2')).toBeUndefined()
  })

  it('user_left for unknown user is a no-op', () => {
    const result = applyPresenceMessage([alice], { type: 'user_left', userId: 'nonexistent' })
    expect(result).toEqual([alice])
  })

  it('presence with empty array clears the list', () => {
    const result = applyPresenceMessage([alice, bob], { type: 'presence', users: [] })
    expect(result).toEqual([])
  })

  it('ignores unknown message types', () => {
    const result = applyPresenceMessage([alice], { type: 'unknown_msg' })
    expect(result).toEqual([alice])
  })
})

describe('lobby challenge message handling', () => {
  it('adds incoming challenge', () => {
    const result = applyChallengeMessage([], {
      type: 'challenge_incoming',
      challengeId: 'ch1',
      from: alice,
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ch1')
    expect(result[0].from).toEqual(alice)
  })

  it('removes challenge on accept', () => {
    const existing: Challenge[] = [
      { id: 'ch1', from: alice, createdAt: 1000 },
      { id: 'ch2', from: bob, createdAt: 2000 },
    ]
    const result = applyChallengeMessage(existing, {
      type: 'challenge_accepted',
      challengeId: 'ch1',
      roomId: 'room123',
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ch2')
  })

  it('removes challenge on decline', () => {
    const existing: Challenge[] = [{ id: 'ch1', from: alice, createdAt: 1000 }]
    const result = applyChallengeMessage(existing, {
      type: 'challenge_declined',
      challengeId: 'ch1',
    })
    expect(result).toEqual([])
  })

  it('decline of nonexistent challenge is a no-op', () => {
    const existing: Challenge[] = [{ id: 'ch1', from: alice, createdAt: 1000 }]
    const result = applyChallengeMessage(existing, {
      type: 'challenge_declined',
      challengeId: 'ch999',
    })
    expect(result).toHaveLength(1)
  })

  it('ignores challenge_incoming without challengeId', () => {
    const result = applyChallengeMessage([], {
      type: 'challenge_incoming',
      from: alice,
    })
    expect(result).toEqual([])
  })

  it('ignores challenge_incoming without from', () => {
    const result = applyChallengeMessage([], {
      type: 'challenge_incoming',
      challengeId: 'ch1',
    })
    expect(result).toEqual([])
  })
})

describe('match history message handling', () => {
  it('replaces history from server message', () => {
    const matches: MatchRecord[] = [
      {
        id: 'r1',
        opponent: { id: 'b2', name: 'Bob', avatar: '' },
        yourColor: 'w',
        winner: 'w',
        reason: 'checkmate',
        moveCount: 24,
        finishedAt: '2026-01-01T00:10:00Z',
      },
    ]
    const msg: LobbyServerMsg = { type: 'history', matches }
    expect(msg.matches).toHaveLength(1)
    expect(msg.matches![0].reason).toBe('checkmate')
  })

  it('handles empty history', () => {
    const msg: LobbyServerMsg = { type: 'history', matches: [] }
    expect(msg.matches).toEqual([])
  })

  it('defaults to empty when matches is undefined', () => {
    const msg: LobbyServerMsg = { type: 'history' }
    expect(msg.matches ?? []).toEqual([])
  })
})
