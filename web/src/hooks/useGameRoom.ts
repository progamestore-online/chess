import { useCallback, useEffect, useMemo, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { useSound, useRooms, useAuth } from '@progamestore/games'
import { buildPgn, copyToClipboard } from '../services/pgn.ts'
import { playSoundForMove } from '../services/sounds.ts'
import type { GameStatus, PlayerInfo } from '../types.ts'

type Color = 'w' | 'b'

interface ServerMsg {
  type: string
  fen?: string
  history?: string[]
  yourColor?: Color | 'spectator'
  opponentConnected?: boolean
  gameOver?: { reason: 'checkmate' | 'stalemate' | 'draw' | 'resigned'; winner: Color | null } | null
  uci?: string
  san?: string
  message?: string
  players?: Record<string, PlayerInfo>
  opponent?: PlayerInfo
}

type ClientMsg =
  | { type: 'move'; uci: string }
  | { type: 'resign' }
  | { type: 'new_game' }

export interface GameRoomState {
  chess: InstanceType<typeof Chess>
  fen: string
  yourColor: Color | 'spectator' | null
  opponentConnected: boolean
  lastMove: { from: Square; to: Square } | null
  selectedSquare: Square | null
  gameOver: ServerMsg['gameOver']
  error: string | null
  players: Record<string, PlayerInfo>
  isPlayer: boolean
  isYourTurn: boolean
  status: GameStatus
  connectionState: 'open' | 'idle' | 'connecting' | 'error' | 'closed'
  shareUrl: string | null
  // Review
  reviewMoveIndex: number | null
  reviewFen: string | null
  reviewLastMove: { from: Square; to: Square } | null
  inReview: boolean
  // Actions
  handleMove: (from: Square, to: Square, promotion?: string) => boolean
  handleNewGame: () => Promise<string>
  handleResign: () => void
  handleRematch: () => void
  setSelectedSquare: (sq: Square | null) => void
  jumpToMove: (idx: number) => void
  prevReview: () => void
  nextReview: () => void
  exitReview: () => void
  exportPgn: () => Promise<boolean>
  copyShareUrl: () => Promise<boolean>
}

export function useGameRoom(
  gameId: string | null,
  reportResult: (result: { roomId: string; white: PlayerInfo; black: PlayerInfo; winner: 'w' | 'b' | null; reason: string; moveCount: number }) => void,
): GameRoomState {
  const { muted } = useSound()
  const { user } = useAuth()
  const [chess] = useState(() => new Chess())
  const [fen, setFen] = useState(chess.fen())
  const [yourColor, setYourColor] = useState<Color | 'spectator' | null>(null)
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [gameOver, setGameOver] = useState<ServerMsg['gameOver']>(null)
  const [error, setError] = useState<string | null>(null)
  const [players, setPlayers] = useState<Record<string, PlayerInfo>>({})
  const [reviewMoveIndex, setReviewMoveIndex] = useState<number | null>(null)

  const shareUrl = useMemo(
    () => (gameId ? `${window.location.origin}/g/${gameId}` : null),
    [gameId],
  )

  useEffect(() => {
    chess.reset()
    setFen(chess.fen())
    setYourColor(null)
    setOpponentConnected(false)
    setLastMove(null)
    setSelectedSquare(null)
    setGameOver(null)
    setError(null)
    setPlayers({})
    setReviewMoveIndex(null)
  }, [gameId])

  const handleServerMessage = useCallback((msg: ServerMsg) => {
    if (msg.type === 'state') {
      if (msg.fen) { chess.load(msg.fen); setFen(chess.fen()) }
      if (msg.yourColor !== undefined) setYourColor(msg.yourColor)
      if (msg.opponentConnected !== undefined) setOpponentConnected(msg.opponentConnected)
      if (msg.players) setPlayers(msg.players)
      setGameOver(msg.gameOver ?? null)
    } else if (msg.type === 'move') {
      if (msg.uci && msg.uci.length >= 4) {
        const from = msg.uci.slice(0, 2)
        const to = msg.uci.slice(2, 4)
        const promotion = msg.uci.length > 4 ? msg.uci[4] : undefined
        try {
          const played = chess.move({ from, to, promotion })
          setFen(chess.fen())
          setLastMove({ from: from as Square, to: to as Square })
          if (played) playSoundForMove(played, muted)
        } catch {}
      }
      if (msg.players) setPlayers(msg.players)
      if (msg.gameOver) {
        setGameOver(msg.gameOver)
        if (gameId && msg.players && user) {
          const p = msg.players
          if (p.w && p.b) {
            reportResult({ roomId: gameId, white: p.w, black: p.b, winner: msg.gameOver.winner, reason: msg.gameOver.reason, moveCount: chess.history().length })
          }
        }
      }
    } else if (msg.type === 'opponent_joined') {
      setOpponentConnected(true)
      if (msg.opponent && msg.players) {
        setPlayers(msg.players)
      } else if (msg.opponent) {
        setPlayers(prev => {
          const myColor = Object.entries(prev).find(([, p]) => p.id === user?.id)?.[0]
          const opColor = myColor === 'w' ? 'b' : myColor === 'b' ? 'w' : 'b'
          return { ...prev, [opColor]: msg.opponent! }
        })
      }
    } else if (msg.type === 'opponent_left') {
      setOpponentConnected(false)
    } else if (msg.type === 'new_game') {
      chess.reset(); setFen(chess.fen()); setLastMove(null); setSelectedSquare(null); setGameOver(null); setError(null)
    } else if (msg.type === 'error') {
      setError(msg.message ?? 'Server error')
    }
  }, [chess, muted, gameId, user, reportResult])

  const room = useRooms<ServerMsg, ClientMsg>({ gameId: 'chess', roomId: gameId, onMessage: handleServerMessage })
  const sendMessage = room.send
  const connectionState: GameRoomState['connectionState'] =
    room.status === 'connected' ? 'open' : room.status === 'idle' ? 'idle' : room.status === 'connecting' ? 'connecting' : room.status === 'error' ? 'error' : 'closed'

  const handleMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    if (yourColor !== 'w' && yourColor !== 'b') return false
    if (chess.turn() !== yourColor || gameOver) return false
    let move
    try { move = chess.move({ from, to, promotion }) } catch { return false }
    if (!move) return false
    setFen(chess.fen()); setLastMove({ from, to }); setSelectedSquare(null)
    playSoundForMove(move, muted)
    sendMessage({ type: 'move', uci: `${from}${to}${promotion ?? ''}` })
    return true
  }, [chess, yourColor, gameOver, sendMessage, muted])

  const handleNewGame = useCallback(async () => room.create(), [room])

  const handleResign = useCallback(() => sendMessage({ type: 'resign' }), [sendMessage])

  const handleRematch = useCallback(() => {
    setReviewMoveIndex(null)
    sendMessage({ type: 'new_game' })
  }, [sendMessage])

  const reviewFen = useMemo(() => {
    if (reviewMoveIndex === null) return null
    const replay = new Chess()
    const moves = chess.history({ verbose: true })
    for (let k = 0; k <= reviewMoveIndex && k < moves.length; k++) replay.move(moves[k])
    return replay.fen()
  }, [reviewMoveIndex, chess, fen])

  const reviewLastMove = useMemo(() => {
    if (reviewMoveIndex === null) return null
    const moves = chess.history({ verbose: true })
    const m = moves[reviewMoveIndex]
    return m ? { from: m.from as Square, to: m.to as Square } : null
  }, [reviewMoveIndex, chess, fen])

  const inReview = reviewMoveIndex !== null
  const jumpToMove = useCallback((idx: number) => setReviewMoveIndex(idx), [])
  const exitReview = useCallback(() => setReviewMoveIndex(null), [])
  const prevReview = useCallback(() => {
    const len = chess.history().length
    setReviewMoveIndex(i => i === null ? len - 1 : Math.max(0, i - 1))
  }, [chess, fen])
  const nextReview = useCallback(() => {
    const len = chess.history().length
    setReviewMoveIndex(i => (i === null || i >= len - 1) ? null : i + 1)
  }, [chess, fen])

  useEffect(() => {
    if (chess.history().length === 0) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevReview() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nextReview() }
      else if (e.key === 'Escape' && inReview) { e.preventDefault(); exitReview() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chess, fen, inReview, prevReview, nextReview, exitReview])

  const exportPgn = useCallback(async () => {
    const result = gameOver?.reason === 'checkmate' || gameOver?.reason === 'resigned'
      ? (gameOver.winner === 'w' ? '1-0' : '0-1')
      : gameOver?.reason === 'stalemate' || gameOver?.reason === 'draw' ? '1/2-1/2' : '*'
    const pgn = buildPgn(chess, {
      event: 'ProGameStore Chess',
      white: players.w?.name ?? (yourColor === 'w' ? 'You' : 'Opponent'),
      black: players.b?.name ?? (yourColor === 'b' ? 'You' : 'Opponent'),
      result,
    })
    return copyToClipboard(pgn)
  }, [chess, gameOver, yourColor, players])

  const copyShareUrlFn = useCallback(async () => {
    if (!shareUrl) return false
    return copyToClipboard(shareUrl)
  }, [shareUrl])

  const isPlayer = yourColor === 'w' || yourColor === 'b'
  const isYourTurn = isPlayer && chess.turn() === yourColor && !gameOver
  const status: GameStatus = !gameOver ? 'playing'
    : gameOver.reason === 'checkmate' ? 'checkmate'
    : gameOver.reason === 'stalemate' ? 'stalemate'
    : gameOver.reason === 'resigned' ? 'resigned' : 'draw'

  return {
    chess, fen, yourColor, opponentConnected, lastMove, selectedSquare,
    gameOver, error, players, isPlayer, isYourTurn, status, connectionState,
    shareUrl, reviewMoveIndex, reviewFen, reviewLastMove, inReview,
    handleMove, handleNewGame, handleResign, handleRematch, setSelectedSquare,
    jumpToMove, prevReview, nextReview, exitReview, exportPgn, copyShareUrl: copyShareUrlFn,
  }
}
