import { DurableObject } from 'cloudflare:workers'

interface UserInfo {
  id: string
  name: string
  avatar: string
}

interface ConnectedUser extends UserInfo {
  ws: WebSocket
  connectedAt: string
  missedPings: number
}

interface Challenge {
  id: string
  from: UserInfo
  to: string
  createdAt: number
}

export class LobbyDO extends DurableObject {
  private users: Map<string, ConnectedUser> = new Map()
  private challenges: Map<string, Challenge> = new Map()
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env)
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS matches (
          id TEXT PRIMARY KEY,
          white_id TEXT NOT NULL,
          white_name TEXT NOT NULL,
          white_avatar TEXT DEFAULT '',
          black_id TEXT NOT NULL,
          black_name TEXT NOT NULL,
          black_avatar TEXT DEFAULT '',
          winner TEXT,
          reason TEXT NOT NULL,
          move_count INTEGER NOT NULL DEFAULT 0,
          finished_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)
      this.ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS idx_matches_white ON matches(white_id)`)
      this.ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS idx_matches_black ON matches(black_id)`)
    })
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) return
    this.heartbeatInterval = setInterval(() => {
      const evicted: string[] = []
      for (const [userId, user] of this.users) {
        if (user.missedPings >= 2) {
          evicted.push(userId)
          try { user.ws.close(1000, 'heartbeat timeout') } catch {}
        } else {
          user.missedPings++
          this.send(user.ws, { type: 'ping' })
        }
      }
      for (const id of evicted) {
        this.users.delete(id)
        this.broadcast({ type: 'user_left', userId: id })
      }
      if (this.users.size === 0) this.stopHeartbeat()
    }, 30_000)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    const userId = req.headers.get('X-User-Id')
    const userName = req.headers.get('X-User-Name')
    const userAvatar = req.headers.get('X-User-Avatar') ?? ''

    if (!userId || !userName) {
      return new Response('Unauthorized', { status: 401 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.accept()

    const existing = this.users.get(userId)
    if (existing) {
      try { existing.ws.close(1000, 'replaced') } catch {}
    }

    const connectedUser: ConnectedUser = {
      id: userId,
      name: userName,
      avatar: userAvatar,
      ws: server,
      connectedAt: new Date().toISOString(),
      missedPings: 0,
    }
    this.users.set(userId, connectedUser)
    this.startHeartbeat()

    this.send(server, {
      type: 'presence',
      users: this.getOnlineList(userId),
    })

    this.broadcast({ type: 'user_joined', user: { id: userId, name: userName, avatar: userAvatar, connectedAt: connectedUser.connectedAt } }, userId)

    server.addEventListener('message', (e) => this.onMessage(userId, e.data as string))
    server.addEventListener('close', () => this.onClose(userId))
    server.addEventListener('error', () => this.onClose(userId))

    return new Response(null, { status: 101, webSocket: client })
  }

  private onMessage(userId: string, data: string) {
    const user = this.users.get(userId)
    if (!user) return

    let msg: { type: string; [key: string]: unknown }
    try { msg = JSON.parse(data) } catch { return }

    user.missedPings = 0

    switch (msg.type) {
      case 'pong':
        break

      case 'challenge':
        this.handleChallenge(userId, msg.targetUserId as string)
        break

      case 'challenge_accept':
        this.handleChallengeAccept(userId, msg.challengeId as string)
        break

      case 'challenge_decline':
        this.handleChallengeDecline(userId, msg.challengeId as string)
        break

      case 'get_history':
        this.handleGetHistory(userId, (msg.limit as number) ?? 20)
        break

      case 'report_result':
        this.handleReportResult(msg)
        break

      default:
        this.send(user.ws, { type: 'error', message: `Unknown message type: ${msg.type}` })
    }
  }

  private onClose(userId: string) {
    this.users.delete(userId)
    this.broadcast({ type: 'user_left', userId })
    if (this.users.size === 0) this.stopHeartbeat()

    const stale = [...this.challenges.entries()]
      .filter(([, c]) => c.from.id === userId || c.to === userId)
      .map(([id]) => id)
    for (const id of stale) this.challenges.delete(id)
  }

  private handleChallenge(fromId: string, targetUserId: string) {
    const from = this.users.get(fromId)
    const target = this.users.get(targetUserId)
    if (!from || !target) {
      if (from) this.send(from.ws, { type: 'error', message: 'Player is not online' })
      return
    }

    const challengeId = crypto.randomUUID().slice(0, 8)
    const challenge: Challenge = {
      id: challengeId,
      from: { id: from.id, name: from.name, avatar: from.avatar },
      to: targetUserId,
      createdAt: Date.now(),
    }
    this.challenges.set(challengeId, challenge)

    setTimeout(() => { this.challenges.delete(challengeId) }, 60_000)

    this.send(target.ws, {
      type: 'challenge_incoming',
      challengeId,
      from: { id: from.id, name: from.name, avatar: from.avatar },
    })
    this.send(from.ws, {
      type: 'challenge_sent',
      challengeId,
      to: { id: target.id, name: target.name, avatar: target.avatar },
    })
  }

  private handleChallengeAccept(userId: string, challengeId: string) {
    const challenge = this.challenges.get(challengeId)
    if (!challenge || challenge.to !== userId) return
    this.challenges.delete(challengeId)

    const fromUser = this.users.get(challenge.from.id)
    const toUser = this.users.get(userId)
    if (!fromUser || !toUser) return

    const roomId = this.generateRoomId()

    this.send(fromUser.ws, {
      type: 'challenge_accepted',
      challengeId,
      roomId,
      opponent: { id: toUser.id, name: toUser.name, avatar: toUser.avatar },
    })
    this.send(toUser.ws, {
      type: 'challenge_accepted',
      challengeId,
      roomId,
      opponent: { id: fromUser.id, name: fromUser.name, avatar: fromUser.avatar },
    })
  }

  private handleChallengeDecline(userId: string, challengeId: string) {
    const challenge = this.challenges.get(challengeId)
    if (!challenge || challenge.to !== userId) return
    this.challenges.delete(challengeId)

    const fromUser = this.users.get(challenge.from.id)
    if (fromUser) {
      this.send(fromUser.ws, { type: 'challenge_declined', challengeId, by: userId })
    }
  }

  private handleGetHistory(userId: string, limit: number) {
    const user = this.users.get(userId)
    if (!user) return

    const clamped = Math.max(1, Math.min(typeof limit === 'number' ? limit : 20, 50))
    const rows = this.ctx.storage.sql.exec(
      `SELECT * FROM matches WHERE white_id = ? OR black_id = ? ORDER BY finished_at DESC LIMIT ?`,
      userId, userId, clamped,
    ).toArray()

    const matches = rows.map((row: Record<string, unknown>) => {
      const isWhite = row.white_id === userId
      return {
        id: row.id as string,
        opponent: {
          id: (isWhite ? row.black_id : row.white_id) as string,
          name: (isWhite ? row.black_name : row.white_name) as string,
          avatar: (isWhite ? row.black_avatar : row.white_avatar) as string,
        },
        yourColor: isWhite ? 'w' : 'b',
        winner: row.winner as string | null,
        reason: row.reason as string,
        moveCount: row.move_count as number,
        finishedAt: row.finished_at as string,
      }
    })

    this.send(user.ws, { type: 'history', matches })
  }

  private handleReportResult(msg: Record<string, unknown>) {
    const roomId = msg.roomId as string
    if (!roomId) return

    const white = msg.white as { id: string; name: string; avatar: string } | undefined
    const black = msg.black as { id: string; name: string; avatar: string } | undefined
    if (!white?.id || !black?.id) return

    const rawWinner = msg.winner as string | null | undefined
    const winner = rawWinner === 'w' || rawWinner === 'b' ? rawWinner : null
    const reason = typeof msg.reason === 'string' ? msg.reason : 'unknown'
    const moveCount = typeof msg.moveCount === 'number' && msg.moveCount >= 0 ? msg.moveCount : 0

    try {
      this.ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO matches (id, white_id, white_name, white_avatar, black_id, black_name, black_avatar, winner, reason, move_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        roomId,
        white.id, white.name ?? '', white.avatar ?? '',
        black.id, black.name ?? '', black.avatar ?? '',
        winner, reason, moveCount,
      )
    } catch {
      // Duplicate insert is fine (idempotent)
    }
  }

  private getOnlineList(excludeId?: string) {
    const list: Array<{ id: string; name: string; avatar: string; connectedAt: string }> = []
    for (const [id, user] of this.users) {
      if (id === excludeId) continue
      list.push({ id: user.id, name: user.name, avatar: user.avatar, connectedAt: user.connectedAt })
    }
    return list
  }

  private generateRoomId(): string {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
    let out = ''
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    for (const b of bytes) out += alphabet[b % alphabet.length]
    return out
  }

  private send(ws: WebSocket, msg: unknown) {
    try { ws.send(JSON.stringify(msg)) } catch {}
  }

  private broadcast(msg: unknown, excludeId?: string) {
    for (const [id, user] of this.users) {
      if (id === excludeId) continue
      this.send(user.ws, msg)
    }
  }
}
