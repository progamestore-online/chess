export type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned'

// --- Lobby & Multi-game types ---

export interface OnlineUser {
  id: string
  name: string
  avatar: string
  connectedAt: string
}

export interface MatchRecord {
  id: string
  opponent: { id: string; name: string; avatar: string }
  yourColor: 'w' | 'b'
  winner: 'w' | 'b' | null
  reason: string
  moveCount: number
  finishedAt: string
}

export interface Challenge {
  id: string
  from: OnlineUser
  createdAt: number
}

export interface GameSlot {
  roomId: string
  fen: string
  yourColor: 'w' | 'b'
  opponentName: string
  opponentAvatar: string
  isYourTurn: boolean
  gameOver: boolean
}

export interface PlayerInfo {
  id: string
  name: string
  avatar: string
}
