import { Chess } from 'chess.js'
import { DurableObject } from 'cloudflare:workers'

const ID_RE = /^[a-z0-9]{6,12}$/

function randomId() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

export class GameDO extends DurableObject {
  constructor(state, env) {
    super(state, env)
    this.chess = new Chess()
    this.players = []
    this.gameOver = null
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    server.accept()

    const colors = new Set(this.players.map(p => p.color))
    const assigned = !colors.has('w') ? 'w' : !colors.has('b') ? 'b' : 'spectator'

    if (assigned !== 'spectator') {
      this.players.push({ ws: server, color: assigned })
      this.broadcast({ type: 'opponent_joined' }, server)
    }

    this.send(server, {
      type: 'state',
      fen: this.chess.fen(),
      history: this.chess.history(),
      yourColor: assigned,
      opponentConnected: this.players.length === 2,
      gameOver: this.gameOver,
    })

    server.addEventListener('message', e => this.onMessage(server, e.data))
    server.addEventListener('close', () => this.onClose(server))
    server.addEventListener('error', () => this.onClose(server))

    return new Response(null, { status: 101, webSocket: client })
  }

  onMessage(ws, data) {
    let msg
    try { msg = JSON.parse(data) } catch { return this.send(ws, { type: 'error', message: 'Invalid JSON' }) }

    const player = this.players.find(p => p.ws === ws)
    if (!player) return this.send(ws, { type: 'error', message: 'Spectators cannot move' })

    // Send the player a fresh state snapshot so they can roll back an optimistic move.
    const reject = (message) => {
      this.send(ws, { type: 'error', message })
      this.sendState(ws, player.color)
    }

    if (msg.type === 'move') {
      if (this.gameOver) return reject('Game is over')
      if (this.chess.turn() !== player.color) return reject('Not your turn')

      const from = msg.uci.slice(0, 2)
      const to = msg.uci.slice(2, 4)
      const promotion = msg.uci.length > 4 ? msg.uci[4] : undefined
      let move
      try { move = this.chess.move({ from, to, promotion }) } catch { return reject('Illegal move') }
      if (!move) return reject('Illegal move')

      this.computeGameOver()
      this.broadcast({
        type: 'move', uci: msg.uci, san: move.san,
        fen: this.chess.fen(), history: this.chess.history(), gameOver: this.gameOver,
      })
      return
    }

    if (msg.type === 'resign') {
      if (this.gameOver) return
      this.gameOver = { reason: 'resigned', winner: player.color === 'w' ? 'b' : 'w' }
      this.broadcast({
        type: 'move', uci: '', san: 'resigns',
        fen: this.chess.fen(), history: this.chess.history(), gameOver: this.gameOver,
      })
      return
    }

    if (msg.type === 'new_game') {
      this.chess = new Chess()
      this.gameOver = null
      this.broadcast({ type: 'new_game' })
      for (const p of this.players) {
        this.send(p.ws, {
          type: 'state',
          fen: this.chess.fen(), history: [],
          yourColor: p.color, opponentConnected: this.players.length === 2, gameOver: null,
        })
      }
    }
  }

  onClose(ws) {
    this.players = this.players.filter(p => p.ws !== ws)
    this.broadcast({ type: 'opponent_left' })
  }

  computeGameOver() {
    if (this.chess.isCheckmate()) {
      this.gameOver = { reason: 'checkmate', winner: this.chess.turn() === 'w' ? 'b' : 'w' }
    } else if (this.chess.isStalemate()) {
      this.gameOver = { reason: 'stalemate', winner: null }
    } else if (this.chess.isDraw()) {
      this.gameOver = { reason: 'draw', winner: null }
    }
  }

  send(ws, msg) {
    try { ws.send(JSON.stringify(msg)) } catch {}
  }

  sendState(ws, yourColor) {
    this.send(ws, {
      type: 'state',
      fen: this.chess.fen(),
      history: this.chess.history(),
      yourColor,
      opponentConnected: this.players.length === 2,
      gameOver: this.gameOver,
    })
  }

  broadcast(msg, except) {
    for (const p of this.players) {
      if (p.ws !== except) this.send(p.ws, msg)
    }
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url)

    // POST /api/rooms/new — mint a new room id. Standardized route name
    // (rooms, not game) so the @progamestore/games useRooms() hook can
    // call the same endpoint across every multiplayer game on the
    // platform.
    if (url.pathname === '/api/rooms/new') {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
      return Response.json({ roomId: randomId() })
    }

    // GET /api/rooms/{id}/ws — upgrade to WebSocket on the DO for this id.
    const wsMatch = url.pathname.match(/^\/api\/rooms\/([a-z0-9-]+)\/ws$/)
    if (wsMatch) {
      const id = wsMatch[1]
      if (!ID_RE.test(id)) return new Response('Invalid room id', { status: 400 })
      const doId = env.GAME.idFromName(id)
      const obj = env.GAME.get(doId)
      return obj.fetch(req)
    }

    // /g/{id} — SPA route. Serve index.html so React-router-style client
    // routing works. With `not_found_handling: single-page-application`
    // in wrangler.jsonc the ASSETS binding handles this automatically,
    // but routing here makes the intent explicit for non-asset 404s.
    if (url.pathname.startsWith('/g/')) {
      url.pathname = '/'
      return env.ASSETS.fetch(new Request(url.toString(), req))
    }

    // Everything else: static asset (or SPA fallback via ASSETS binding).
    return env.ASSETS.fetch(req)
  },
}
