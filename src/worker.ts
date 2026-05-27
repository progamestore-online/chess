export { GameDO } from './game.ts'
export { LobbyDO } from './lobby.ts'

interface Env {
  ASSETS: Fetcher
  GAME: DurableObjectNamespace
  LOBBY: DurableObjectNamespace
  AUTH: Fetcher
}

async function getUser(request: Request, env: Env): Promise<{ id: string; name: string; avatar: string } | null> {
  try {
    const res = await env.AUTH.fetch('https://auth/me', { headers: { Cookie: request.headers.get('Cookie') ?? '' } })
    if (!res.ok) return null
    const user = await res.json() as { id: string; name: string; avatar: string }
    if (!user.id) return null
    return { id: user.id, name: user.name ?? '', avatar: user.avatar ?? '' }
  } catch { return null }
}

const ID_RE = /^[a-z0-9]{6,12}$/

function randomId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === '/api/rooms/new') {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
      return Response.json({ roomId: randomId() })
    }

    const wsMatch = url.pathname.match(/^\/api\/rooms\/([a-z0-9]+)\/ws$/)
    if (wsMatch) {
      const id = wsMatch[1]
      if (!ID_RE.test(id)) return new Response('Invalid room id', { status: 400 })
      const user = await getUser(req, env)
      const headers = new Headers(req.headers)
      if (user) {
        headers.set('X-User-Id', user.id)
        headers.set('X-User-Name', user.name)
        headers.set('X-User-Avatar', user.avatar)
      }
      return env.GAME.get(env.GAME.idFromName(id)).fetch(new Request(req.url, { headers, method: req.method, body: req.body }))
    }

    if (url.pathname === '/api/lobby/ws') {
      const user = await getUser(req, env)
      if (!user) return new Response('Unauthorized', { status: 401 })
      const headers = new Headers(req.headers)
      headers.set('X-User-Id', user.id)
      headers.set('X-User-Name', user.name)
      headers.set('X-User-Avatar', user.avatar)
      return env.LOBBY.get(env.LOBBY.idFromName('chess-lobby')).fetch(new Request(req.url, { headers, method: req.method, body: req.body }))
    }

    if (url.pathname.startsWith('/g/')) {
      url.pathname = '/'
      return env.ASSETS.fetch(new Request(url.toString(), req))
    }

    return env.ASSETS.fetch(req)
  },
}
