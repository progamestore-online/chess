import { describe, it, expect } from 'vitest'

function parseRoute(path: string): { gameId: string | null } {
  const gameMatch = path.match(/^\/g\/([a-z0-9]{6,12})$/)
  if (gameMatch) return { gameId: gameMatch[1] }
  return { gameId: null }
}

const ID_RE = /^[a-z0-9]{6,12}$/
const WS_ROUTE_RE = /^\/api\/rooms\/([a-z0-9]+)\/ws$/

function matchWorkerRoute(pathname: string): { type: string; id?: string } {
  if (pathname === '/api/rooms/new') return { type: 'rooms_new' }
  const wsMatch = pathname.match(WS_ROUTE_RE)
  if (wsMatch) {
    const id = wsMatch[1]
    if (!ID_RE.test(id)) return { type: 'invalid_room' }
    return { type: 'room_ws', id }
  }
  if (pathname === '/api/lobby/ws') return { type: 'lobby_ws' }
  if (pathname.startsWith('/g/')) return { type: 'spa_game' }
  return { type: 'static' }
}

describe('client-side route parsing', () => {
  it('root path returns no gameId', () => {
    expect(parseRoute('/')).toEqual({ gameId: null })
  })

  it('valid game path returns gameId', () => {
    expect(parseRoute('/g/abc12345')).toEqual({ gameId: 'abc12345' })
  })

  it('6-char id is valid', () => {
    expect(parseRoute('/g/abcdef')).toEqual({ gameId: 'abcdef' })
  })

  it('12-char id is valid', () => {
    expect(parseRoute('/g/abcdef123456')).toEqual({ gameId: 'abcdef123456' })
  })

  it('rejects id shorter than 6', () => {
    expect(parseRoute('/g/abc')).toEqual({ gameId: null })
  })

  it('rejects id longer than 12', () => {
    expect(parseRoute('/g/abcdefghijklm')).toEqual({ gameId: null })
  })

  it('rejects uppercase', () => {
    expect(parseRoute('/g/ABCDEF')).toEqual({ gameId: null })
  })

  it('rejects hyphens', () => {
    expect(parseRoute('/g/abc-def')).toEqual({ gameId: null })
  })

  it('rejects trailing slash', () => {
    expect(parseRoute('/g/abcdef/')).toEqual({ gameId: null })
  })

  it('non-game paths return null', () => {
    expect(parseRoute('/multiplayer')).toEqual({ gameId: null })
    expect(parseRoute('/play')).toEqual({ gameId: null })
    expect(parseRoute('/puzzles')).toEqual({ gameId: null })
  })
})

describe('worker route matching', () => {
  it('matches /api/rooms/new', () => {
    expect(matchWorkerRoute('/api/rooms/new')).toEqual({ type: 'rooms_new' })
  })

  it('matches valid room WebSocket', () => {
    expect(matchWorkerRoute('/api/rooms/abc12345/ws')).toEqual({ type: 'room_ws', id: 'abc12345' })
  })

  it('rejects room id with hyphens', () => {
    expect(matchWorkerRoute('/api/rooms/abc-def/ws').type).not.toBe('room_ws')
  })

  it('rejects room id too short', () => {
    expect(matchWorkerRoute('/api/rooms/abc/ws')).toEqual({ type: 'invalid_room' })
  })

  it('rejects room id too long', () => {
    expect(matchWorkerRoute('/api/rooms/abcdefghijklm/ws')).toEqual({ type: 'invalid_room' })
  })

  it('matches lobby WebSocket', () => {
    expect(matchWorkerRoute('/api/lobby/ws')).toEqual({ type: 'lobby_ws' })
  })

  it('matches SPA game route', () => {
    expect(matchWorkerRoute('/g/abc12345')).toEqual({ type: 'spa_game' })
  })

  it('falls through to static for unknown paths', () => {
    expect(matchWorkerRoute('/')).toEqual({ type: 'static' })
    expect(matchWorkerRoute('/assets/index.js')).toEqual({ type: 'static' })
  })

  it('rooms/new does not match with extra path', () => {
    expect(matchWorkerRoute('/api/rooms/new/extra').type).not.toBe('rooms_new')
  })
})
