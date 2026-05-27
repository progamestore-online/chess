import { Chess } from 'chess.js'
import { DurableObject } from 'cloudflare:workers'

interface Player {
  ws: WebSocket
  color: 'w' | 'b'
  userId: string
  name: string
  avatar: string
}

function randomId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

export class GameDO extends DurableObject {
  private chess: InstanceType<typeof Chess>
  private players: Player[]
  private gameOver: { reason: string; winner: 'w' | 'b' | null } | null
  private playerRecords: Record<string, { id: string; name: string; avatar: string }>

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env)
    this.chess = new Chess()
    this.players = []
    this.gameOver = null
    this.playerRecords = {}

    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS game_state (
          id TEXT PRIMARY KEY DEFAULT 'current',
          pgn TEXT NOT NULL DEFAULT '',
          game_over_reason TEXT,
          game_over_winner TEXT,
          white_id TEXT, white_name TEXT, white_avatar TEXT,
          black_id TEXT, black_name TEXT, black_avatar TEXT
        )
      `)
      const rows = this.ctx.storage.sql.exec(`SELECT * FROM game_state WHERE id = 'current'`).toArray()
      if (rows.length > 0) {
        const row = rows[0] as Record<string, unknown>
        const pgn = row.pgn as string
        if (pgn) {
          try { this.chess.loadPgn(pgn) } catch {}
        }
        if (row.game_over_reason) {
          const winner = row.game_over_winner as string | null
          this.gameOver = { reason: row.game_over_reason as string, winner: winner === 'w' || winner === 'b' ? winner : null }
        }
        if (row.white_id) this.playerRecords.w = { id: row.white_id as string, name: (row.white_name as string) ?? '', avatar: (row.white_avatar as string) ?? '' }
        if (row.black_id) this.playerRecords.b = { id: row.black_id as string, name: (row.black_name as string) ?? '', avatar: (row.black_avatar as string) ?? '' }
      }
    })
  }

  private persist() {
    const info = this.getPlayersInfo()
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO game_state (id, pgn, game_over_reason, game_over_winner, white_id, white_name, white_avatar, black_id, black_name, black_avatar)
       VALUES ('current', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      this.chess.pgn(),
      this.gameOver?.reason ?? null, this.gameOver?.winner ?? null,
      info.w?.id ?? null, info.w?.name ?? null, info.w?.avatar ?? null,
      info.b?.id ?? null, info.b?.name ?? null, info.b?.avatar ?? null,
    )
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.accept()

    const userId = req.headers.get('X-User-Id') ?? 'anon-' + randomId()
    const userName = req.headers.get('X-User-Name') ?? 'Anonymous'
    const userAvatar = req.headers.get('X-User-Avatar') ?? ''

    const liveColors = new Set(this.players.map(p => p.color))
    const returningColor = (this.playerRecords.w?.id === userId && !liveColors.has('w')) ? 'w'
      : (this.playerRecords.b?.id === userId && !liveColors.has('b')) ? 'b' : null
    const assigned: 'w' | 'b' | 'spectator' = returningColor
      ?? (!liveColors.has('w') ? 'w' : !liveColors.has('b') ? 'b' : 'spectator')

    if (assigned !== 'spectator') {
      this.players.push({ ws: server, color: assigned, userId, name: userName, avatar: userAvatar })
      this.playerRecords[assigned] = { id: userId, name: userName, avatar: userAvatar }
      this.persist()
      this.broadcast({ type: 'opponent_joined', opponent: { id: userId, name: userName, avatar: userAvatar } }, server)
    }

    this.send(server, {
      type: 'state', fen: this.chess.fen(), history: this.chess.history(),
      yourColor: assigned, opponentConnected: this.players.length === 2,
      gameOver: this.gameOver, players: this.getPlayersInfo(),
    })

    server.addEventListener('message', (e) => this.onMessage(server, e.data as string))
    server.addEventListener('close', () => this.onClose(server))
    server.addEventListener('error', () => this.onClose(server))

    return new Response(null, { status: 101, webSocket: client })
  }

  private onMessage(ws: WebSocket, data: string) {
    let msg: { type: string; [key: string]: unknown }
    try { msg = JSON.parse(data) } catch { return this.send(ws, { type: 'error', message: 'Invalid JSON' }) }

    const player = this.players.find(p => p.ws === ws)
    if (!player) return this.send(ws, { type: 'error', message: 'Spectators cannot move' })

    const reject = (message: string) => {
      this.send(ws, { type: 'error', message })
      this.sendState(ws, player.color)
    }

    if (msg.type === 'move') {
      if (this.gameOver) return reject('Game is over')
      if (this.chess.turn() !== player.color) return reject('Not your turn')
      if (typeof msg.uci !== 'string' || msg.uci.length < 4) return reject('Invalid move')
      const from = msg.uci.slice(0, 2), to = msg.uci.slice(2, 4), promotion = msg.uci.length > 4 ? msg.uci[4] : undefined
      let move
      try { move = this.chess.move({ from, to, promotion }) } catch { return reject('Illegal move') }
      if (!move) return reject('Illegal move')
      this.computeGameOver()
      this.persist()
      this.broadcastAll({ type: 'move', uci: msg.uci, san: move.san, fen: this.chess.fen(), history: this.chess.history(), gameOver: this.gameOver, players: this.getPlayersInfo() })
      return
    }

    if (msg.type === 'resign') {
      if (this.gameOver) return
      this.gameOver = { reason: 'resigned', winner: player.color === 'w' ? 'b' : 'w' }
      this.persist()
      this.broadcastAll({ type: 'move', uci: '', san: 'resigns', fen: this.chess.fen(), history: this.chess.history(), gameOver: this.gameOver, players: this.getPlayersInfo() })
      return
    }

    if (msg.type === 'new_game') {
      this.chess = new Chess()
      this.gameOver = null
      this.playerRecords = {}
      for (const p of this.players) this.playerRecords[p.color] = { id: p.userId, name: p.name, avatar: p.avatar }
      this.persist()
      this.broadcastAll({ type: 'new_game' })
      for (const p of this.players) {
        this.send(p.ws, { type: 'state', fen: this.chess.fen(), history: [], yourColor: p.color, opponentConnected: this.players.length === 2, gameOver: null, players: this.getPlayersInfo() })
      }
    }
  }

  private onClose(ws: WebSocket) {
    this.players = this.players.filter(p => p.ws !== ws)
    this.broadcastAll({ type: 'opponent_left' })
  }

  private computeGameOver() {
    if (this.chess.isCheckmate()) this.gameOver = { reason: 'checkmate', winner: this.chess.turn() === 'w' ? 'b' : 'w' }
    else if (this.chess.isStalemate()) this.gameOver = { reason: 'stalemate', winner: null }
    else if (this.chess.isDraw()) this.gameOver = { reason: 'draw', winner: null }
  }

  private getPlayersInfo() {
    const info: Record<string, { id: string; name: string; avatar: string }> = { ...this.playerRecords }
    for (const p of this.players) info[p.color] = { id: p.userId, name: p.name, avatar: p.avatar }
    return info
  }

  private send(ws: WebSocket, msg: unknown) { try { ws.send(JSON.stringify(msg)) } catch {} }

  private sendState(ws: WebSocket, yourColor: string) {
    this.send(ws, { type: 'state', fen: this.chess.fen(), history: this.chess.history(), yourColor, opponentConnected: this.players.length === 2, gameOver: this.gameOver, players: this.getPlayersInfo() })
  }

  private broadcast(msg: unknown, except?: WebSocket) { for (const p of this.players) { if (p.ws !== except) this.send(p.ws, msg) } }
  private broadcastAll(msg: unknown) { for (const p of this.players) this.send(p.ws, msg) }
}
