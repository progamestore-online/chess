import { useCallback, useEffect, useMemo, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Board } from './Board.tsx'
import { GameOverBanner } from './GameOverBanner.tsx'
import { MoveList } from './MoveList.tsx'
import { PlayerRow } from './PlayerRow.tsx'
import { LobbyView } from './LobbyView.tsx'
import { ActiveGamesStrip } from './ActiveGamesStrip.tsx'
import { ChallengeNotification } from './ChallengeNotification.tsx'
import { buildPgn, copyToClipboard } from '../services/pgn.ts'
import { playSoundForMove } from '../services/sounds.ts'
import { useSound, useRooms, useAuth } from '@progamestore/games'
import { useLobby } from '../hooks/useLobby.ts'
import { useMultiGame } from '../hooks/useMultiGame.ts'
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

interface MultiplayerTabProps {
  gameId: string | null
  onLoadGame: (id: string) => void
  flipped: boolean
  onFlip: () => void
}

export function MultiplayerTab({ gameId, onLoadGame, flipped, onFlip }: MultiplayerTabProps) {
  const { muted } = useSound()
  const { user } = useAuth()
  const lobby = useLobby()
  const multiGame = useMultiGame()
  const [chess] = useState(() => new Chess())
  const [fen, setFen] = useState(chess.fen())
  const [yourColor, setYourColor] = useState<Color | 'spectator' | null>(null)
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [gameOver, setGameOver] = useState<ServerMsg['gameOver']>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
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

  useEffect(() => {
    return lobby.onChallengeAccepted((roomId) => {
      onLoadGame(roomId)
      multiGame.addGame({
        roomId,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        yourColor: 'w',
        opponentName: '',
        opponentAvatar: '',
        isYourTurn: true,
        gameOver: false,
      })
    })
  }, [lobby.onChallengeAccepted, onLoadGame, multiGame.addGame])

  const reportResult = lobby.reportResult
  const handleServerMessage = useCallback((msg: ServerMsg) => {
    if (msg.type === 'state') {
      if (msg.fen) {
        chess.load(msg.fen)
        setFen(chess.fen())
      }
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
            reportResult({
              roomId: gameId,
              white: p.w,
              black: p.b,
              winner: msg.gameOver.winner,
              reason: msg.gameOver.reason,
              moveCount: chess.history().length,
            })
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
      chess.reset()
      setFen(chess.fen())
      setLastMove(null)
      setSelectedSquare(null)
      setGameOver(null)
      setError(null)
    } else if (msg.type === 'error') {
      setError(msg.message ?? 'Server error')
    }
  }, [chess, muted, gameId, user, reportResult])

  const updateGame = multiGame.updateGame
  useEffect(() => {
    if (!gameId) return
    const opColor = yourColor === 'w' ? 'b' : 'w'
    const opponent = players[opColor]
    updateGame(gameId, {
      fen,
      yourColor: yourColor === 'w' || yourColor === 'b' ? yourColor : 'w',
      opponentName: opponent?.name ?? '',
      opponentAvatar: opponent?.avatar ?? '',
      isYourTurn: (yourColor === 'w' || yourColor === 'b') && chess.turn() === yourColor && !gameOver,
      gameOver: !!gameOver,
    })
  }, [fen, yourColor, gameOver, players, gameId, updateGame])

  const room = useRooms<ServerMsg, ClientMsg>({
    gameId: 'chess',
    roomId: gameId,
    onMessage: handleServerMessage,
  })
  const sendMessage = room.send
  const connectionState =
    room.status === 'connected' ? 'open' :
    room.status === 'idle' ? 'idle' :
    room.status === 'connecting' ? 'connecting' :
    room.status === 'error' ? 'error' : 'closed'

  const handleMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    if (yourColor !== 'w' && yourColor !== 'b') return false
    if (chess.turn() !== yourColor) return false
    if (gameOver) return false

    const uci = `${from}${to}${promotion ?? ''}`
    let move
    try { move = chess.move({ from, to, promotion }) } catch { return false }
    if (!move) return false

    setFen(chess.fen())
    setLastMove({ from, to })
    setSelectedSquare(null)
    playSoundForMove(move, muted)
    sendMessage({ type: 'move', uci })
    return true
  }, [chess, yourColor, gameOver, sendMessage, muted])

  const handleNewGame = useCallback(async () => {
    const id = await room.create()
    onLoadGame(id)
    multiGame.addGame({
      roomId: id,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      yourColor: 'w',
      opponentName: '',
      opponentAvatar: '',
      isYourTurn: true,
      gameOver: false,
    })
  }, [room, onLoadGame, multiGame])

  const handleResign = useCallback(() => {
    sendMessage({ type: 'resign' })
  }, [sendMessage])

  const handleRematch = useCallback(() => {
    setReviewMoveIndex(null)
    sendMessage({ type: 'new_game' })
  }, [sendMessage])

  // Move review (step through history, no analysis)
  const reviewFen = useMemo(() => {
    if (reviewMoveIndex === null) return null
    const replay = new Chess()
    const moves = chess.history({ verbose: true })
    for (let k = 0; k <= reviewMoveIndex && k < moves.length; k++) {
      replay.move(moves[k])
    }
    return replay.fen()
  }, [reviewMoveIndex, chess, fen])

  const reviewLastMove = useMemo(() => {
    if (reviewMoveIndex === null) return null
    const moves = chess.history({ verbose: true })
    const m = moves[reviewMoveIndex]
    return m ? { from: m.from as Square, to: m.to as Square } : null
  }, [reviewMoveIndex, chess, fen])

  const inReview = reviewMoveIndex !== null
  const exitReview = useCallback(() => setReviewMoveIndex(null), [])
  const prevReview = useCallback(() => {
    const len = chess.history().length
    setReviewMoveIndex(i => i === null ? len - 1 : Math.max(0, i - 1))
  }, [chess, fen])
  const nextReview = useCallback(() => {
    const len = chess.history().length
    setReviewMoveIndex(i => {
      if (i === null || i >= len - 1) return null
      return i + 1
    })
  }, [chess, fen])

  useEffect(() => {
    if (chess.history().length === 0) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevReview() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nextReview() }
      else if (e.key === 'Escape' && inReview) { e.preventDefault(); exitReview() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chess, fen, inReview, prevReview, nextReview, exitReview])

  const [pgnCopied, setPgnCopied] = useState(false)
  const exportPgn = useCallback(async () => {
    const result =
      gameOver?.reason === 'checkmate' ? (gameOver.winner === 'w' ? '1-0' : '0-1')
      : gameOver?.reason === 'resigned' ? (gameOver.winner === 'w' ? '1-0' : '0-1')
      : (gameOver?.reason === 'stalemate' || gameOver?.reason === 'draw') ? '1/2-1/2'
      : '*'
    const pgn = buildPgn(chess, {
      event: 'ProGameStore Chess',
      white: players.w?.name ?? (yourColor === 'w' ? 'You' : 'Opponent'),
      black: players.b?.name ?? (yourColor === 'b' ? 'You' : 'Opponent'),
      result,
    })
    const ok = await copyToClipboard(pgn)
    if (ok) {
      setPgnCopied(true)
      setTimeout(() => setPgnCopied(false), 1500)
    }
  }, [chess, gameOver, yourColor, players])

  const copyShareUrl = useCallback(async () => {
    if (!shareUrl) return
    const ok = await copyToClipboard(shareUrl)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [shareUrl])

  // --- Lobby view (no game focused) ---
  if (!gameId) {
    return (
      <div className="flex flex-col gap-3 h-full overflow-hidden">
        {multiGame.games.length > 0 && (
          <div className="shrink-0 px-1 pt-1">
            <ActiveGamesStrip
              games={multiGame.games}
              activeGameId={multiGame.activeGameId}
              onSwitch={(id) => { multiGame.switchTo(id); onLoadGame(id) }}
              onRemove={multiGame.removeGame}
            />
          </div>
        )}

        {lobby.incomingChallenges.length > 0 && (
          <div className="shrink-0 px-1">
            <ChallengeNotification
              challenges={lobby.incomingChallenges}
              onAccept={lobby.acceptChallenge}
              onDecline={lobby.declineChallenge}
            />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          <LobbyView
            onlineUsers={lobby.onlineUsers}
            history={lobby.history}
            connected={lobby.connected}
            onChallenge={lobby.challenge}
            onCreateGame={handleNewGame}
          />
        </div>
      </div>
    )
  }

  // --- Active game view ---
  const isPlayer = yourColor === 'w' || yourColor === 'b'
  const isYourTurn = isPlayer && chess.turn() === yourColor && !gameOver
  const boardFlipped = flipped !== (yourColor === 'b')
  const status: GameStatus =
    !gameOver ? 'playing'
    : gameOver.reason === 'checkmate' ? 'checkmate'
    : gameOver.reason === 'stalemate' ? 'stalemate'
    : gameOver.reason === 'resigned' ? 'resigned'
    : 'draw'

  const opColor = yourColor === 'w' ? 'b' : 'w'
  const opponentInfo = players[opColor]

  return (
    <div className="flex flex-col gap-1 h-full overflow-hidden">
      {multiGame.games.length > 0 && (
        <div className="shrink-0 px-1 mb-1">
          <ActiveGamesStrip
            games={multiGame.games}
            activeGameId={gameId}
            onSwitch={(id) => { multiGame.switchTo(id); onLoadGame(id) }}
            onRemove={multiGame.removeGame}
          />
        </div>
      )}

      {lobby.incomingChallenges.length > 0 && (
        <div className="shrink-0 px-1">
          <ChallengeNotification
            challenges={lobby.incomingChallenges}
            onAccept={lobby.acceptChallenge}
            onDecline={lobby.declineChallenge}
          />
        </div>
      )}

      <div className="flex flex-col gap-1 landscape:flex-row landscape:gap-3 lg:flex-row lg:gap-6 flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col gap-1 lg:gap-2 landscape:w-[min(55%,560px)] lg:w-[min(60%,560px)] min-h-0 shrink-0">
          <PlayerRow
            variant="opponent"
            kingGlyph={yourColor === 'w' ? '♚' : '♔'}
            label={opponentInfo?.name ?? (opponentConnected ? 'Opponent' : 'Waiting for opponent...')}
            avatar={opponentInfo?.avatar}
            right={!opponentConnected && (
              <span className="ml-auto text-xs text-[var(--muted)] animate-pulse">share the link →</span>
            )}
          />

          <div className="flex-1 min-h-0">
            <Board
              chess={chess}
              flipped={boardFlipped}
              playerColor={isPlayer ? yourColor : 'w'}
              onMove={handleMove}
              lastMove={inReview ? reviewLastMove : lastMove}
              selectedSquare={inReview ? null : selectedSquare}
              onSquareClick={(sq) => setSelectedSquare(sq)}
              previewFen={inReview ? reviewFen : null}
              previewLabel={inReview ? `Move ${Math.floor((reviewMoveIndex ?? 0) / 2) + 1}${(reviewMoveIndex ?? 0) % 2 === 0 ? '' : '...'}` : ''}
            />
          </div>

          <PlayerRow
            variant="player"
            kingGlyph={yourColor === 'w' ? '♔' : yourColor === 'b' ? '♚' : '♔'}
            label={players[yourColor as string]?.name ?? (yourColor === 'spectator' ? 'Spectating' : `You (${yourColor === 'w' ? 'White' : 'Black'})`)}
            avatar={players[yourColor as string]?.avatar}
            right={isYourTurn && (
              <span className="ml-1 rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--success)]">
                Your turn
              </span>
            )}
          />
        </div>

        <div className="flex flex-col gap-2 lg:gap-3 flex-1 lg:min-w-[240px] min-h-0 min-w-0 overflow-y-auto">
          {shareUrl && !opponentConnected && (
            <div className="flex items-center gap-1.5 rounded-[0.75rem] border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-2.5 py-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 truncate bg-transparent text-xs text-[var(--ink)] outline-none"
                onClick={(e) => e.currentTarget.select()}
              />
              <button
                className="shrink-0 rounded-[0.5rem] bg-[var(--accent)] px-3 py-1.5 text-[0.65rem] font-bold text-white hover:brightness-110 transition"
                onClick={copyShareUrl}
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          )}

          <div className="flex gap-1.5 shrink-0 flex-wrap">
            <button onClick={handleNewGame} className="flex items-center gap-1.5 rounded-[0.5rem] bg-[var(--accent)] px-3 py-2 text-[0.65rem] font-bold text-white hover:brightness-110 transition">
              + New
            </button>
            <button onClick={onFlip} className="flex items-center gap-1.5 rounded-[0.5rem] border border-[var(--line)] bg-[var(--glass)] px-3 py-2 text-[0.65rem] font-bold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--glass-hover)] transition">
              Flip
            </button>
            {isPlayer && !gameOver && (
              <button onClick={handleResign} className="flex items-center gap-1.5 rounded-[0.5rem] border border-red-400/20 bg-red-400/5 px-3 py-2 text-[0.65rem] font-bold text-red-400 hover:bg-red-400/10 transition">
                Resign
              </button>
            )}
            {gameOver && isPlayer && (
              <button onClick={handleRematch} className="flex items-center gap-1.5 rounded-[0.5rem] bg-[var(--accent)] px-3 py-2 text-[0.65rem] font-bold text-white hover:brightness-110 transition">
                Rematch
              </button>
            )}
            {gameOver && chess.history().length > 0 && (
              <button onClick={exportPgn} className="flex items-center gap-1.5 rounded-[0.5rem] border border-[var(--line)] bg-[var(--glass)] px-3 py-2 text-[0.65rem] font-bold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--glass-hover)] transition">
                {pgnCopied ? 'Copied!' : 'PGN'}
              </button>
            )}
          </div>

          {connectionState !== 'open' && (
            <div className="flex items-center gap-1.5 text-[0.65rem] text-[var(--muted)]">
              <div className={`w-1.5 h-1.5 rounded-full ${connectionState === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
              {connectionState === 'connecting' && 'Connecting...'}
              {connectionState === 'closed' && 'Reconnecting...'}
              {connectionState === 'error' && 'Connection error'}
            </div>
          )}

          {error && (
            <div className="rounded-[0.5rem] border border-red-400/20 bg-red-400/5 px-2.5 py-1.5 text-xs text-red-400">
              {error}
            </div>
          )}

          <GameOverBanner
            status={status}
            playerLost={!!gameOver && gameOver.winner !== null && gameOver.winner !== yourColor}
            onPlayAgain={handleRematch}
          />

          <div className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass-soft)] p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
                {inReview ? `Move ${Math.floor((reviewMoveIndex ?? 0) / 2) + 1}${(reviewMoveIndex ?? 0) % 2 === 0 ? ' (white)' : ' (black)'}` : 'Moves'}
              </div>
              {chess.history().length > 0 && (
                <div className="flex gap-0.5">
                  <NavBtn onClick={prevReview} disabled={reviewMoveIndex === 0} title="Previous">‹</NavBtn>
                  <NavBtn onClick={nextReview} disabled={!inReview} title="Next">›</NavBtn>
                  {inReview && (
                    <button
                      type="button"
                      onClick={exitReview}
                      className="rounded-[0.25rem] bg-[var(--accent)]/10 px-2 py-0.5 text-[0.6rem] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition"
                    >Live</button>
                  )}
                </div>
              )}
            </div>
            <MoveList
              history={chess.history()}
              activeReviewMove={reviewMoveIndex}
              onJumpToMove={(idx) => setReviewMoveIndex(idx)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function NavBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-[0.25rem] border border-[var(--line)] bg-[var(--glass)] w-6 h-6 flex items-center justify-center text-xs font-mono text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-25 transition"
    >
      {children}
    </button>
  )
}
