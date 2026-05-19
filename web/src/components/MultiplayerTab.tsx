import { useCallback, useEffect, useMemo, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Board } from './Board.tsx'
import { GameOverBanner } from './GameOverBanner.tsx'
import { GameSummary } from './GameSummary.tsx'
import { MoveList } from './MoveList.tsx'
import { PlayerRow } from './PlayerRow.tsx'
import { analyzePlayerMove } from '../services/analysis.ts'
import { findOpening } from '../services/openings.ts'
import { buildPgn, copyToClipboard } from '../services/pgn.ts'
import { playSoundForMove } from '../services/sounds.ts'
import { stockfish } from '../services/stockfish.ts'
import { useSound, useRooms } from '@progamestore/games'
import type { GameStatus, MoveAnalysis } from '../types.ts'

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
}

// Outgoing messages: just three. The protocol is intentionally tiny —
// the DO is the source of truth, so the client only needs to ask for a
// move, a resign, or a fresh game.
type ClientMsg =
  | { type: 'move'; uci: string }
  | { type: 'resign' }
  | { type: 'new_game' }

interface MultiplayerTabProps {
  // Named gameId at the prop level (App.tsx route is /g/<id>) but semantically
  // a roomId — passed straight through to useRooms({ roomId }).
  gameId: string | null
  onLoadGame: (id: string) => void
  flipped: boolean
  onFlip: () => void
}

export function MultiplayerTab({ gameId, onLoadGame, flipped, onFlip }: MultiplayerTabProps) {
  const { muted } = useSound()
  const [chess] = useState(() => new Chess())
  const [fen, setFen] = useState(chess.fen())
  const [yourColor, setYourColor] = useState<Color | 'spectator' | null>(null)
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [gameOver, setGameOver] = useState<ServerMsg['gameOver']>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Post-game review state
  const [analyses, setAnalyses] = useState<Record<number, MoveAnalysis>>({})
  const [reviewMoveIndex, setReviewMoveIndex] = useState<number | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)

  const shareUrl = useMemo(
    () => (gameId ? `${window.location.origin}/g/${gameId}` : null),
    [gameId],
  )

  // Multiplayer transport — all WebSocket bookkeeping (connect on roomId,
  // JSON parse, close cleanup) lives in the hook. We just translate server
  // messages into local chess state here.
  const handleServerMessage = useCallback((msg: ServerMsg) => {
    if (msg.type === 'state') {
      if (msg.fen) {
        chess.load(msg.fen)
        setFen(chess.fen())
      }
      if (msg.yourColor !== undefined) setYourColor(msg.yourColor)
      if (msg.opponentConnected !== undefined) setOpponentConnected(msg.opponentConnected)
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
        } catch {
          // Server applied a move our local chess.js refused; the next
          // 'state' broadcast will resync. Silent.
        }
      }
      setGameOver(msg.gameOver ?? null)
    } else if (msg.type === 'opponent_joined') {
      setOpponentConnected(true)
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
  }, [chess, muted])

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
    // Validate locally first for a snappy UX; server will re-validate.
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
  }, [room, onLoadGame])

  const handleResign = useCallback(() => {
    sendMessage({ type: 'resign' })
  }, [sendMessage])

  const handleRematch = useCallback(() => {
    setAnalyses({})
    setReviewMoveIndex(null)
    setAnalyzing(false)
    setAnalyzeProgress(0)
    sendMessage({ type: 'new_game' })
  }, [sendMessage])

  // Run Stockfish-backed analysis on every move (skipping spectator games and
  // already-analyzed moves). Runs serially through the move history; queue
  // ordering is enforced by stockfish.ts so concurrent calls are safe.
  const runAnalysis = useCallback(async () => {
    if (yourColor !== 'w' && yourColor !== 'b') return
    setAnalyzing(true)
    setAnalyzeProgress(0)

    // Make sure Stockfish is loaded; fall back to minimax via difficulty < 3
    const useSF = await stockfish.init()

    const replay = new Chess()
    const moves = chess.history({ verbose: true })
    let done = 0
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i]
      if (m.color === yourColor && !analyses[i]) {
        try {
          const analysis = await analyzePlayerMove(replay, m.san, yourColor, useSF ? 3 : 2)
          setAnalyses(prev => ({ ...prev, [i]: analysis }))
        } catch {
          // Analysis can fail mid-game (Stockfish hiccup); just skip the move.
        }
      }
      replay.move(m)
      done++
      setAnalyzeProgress(Math.round((done / moves.length) * 100))
    }
    setAnalyzing(false)
  }, [chess, yourColor, analyses])

  // Review helpers — same shape as PlayTab
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

  const opening = useMemo(() => findOpening(chess.history()), [chess, fen])

  const [pgnCopied, setPgnCopied] = useState(false)
  const exportPgn = useCallback(async () => {
    const result =
      gameOver?.reason === 'checkmate' ? (gameOver.winner === 'w' ? '1-0' : '0-1')
      : gameOver?.reason === 'resigned' ? (gameOver.winner === 'w' ? '1-0' : '0-1')
      : (gameOver?.reason === 'stalemate' || gameOver?.reason === 'draw') ? '1/2-1/2'
      : '*'
    const pgn = buildPgn(chess, {
      event: 'Chess multiplayer',
      white: yourColor === 'w' ? 'You' : 'Opponent',
      black: yourColor === 'b' ? 'You' : 'Opponent',
      result,
    })
    const ok = await copyToClipboard(pgn)
    if (ok) {
      setPgnCopied(true)
      setTimeout(() => setPgnCopied(false), 1500)
    }
  }, [chess, gameOver, yourColor])

  const copyShareUrl = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Older browsers: select-and-copy fallback
      const el = document.createElement('textarea')
      el.value = shareUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [shareUrl])

  if (!gameId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] p-6 text-center">
          <h2 className="text-xl font-bold text-[var(--ink)]">Play with a friend</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Create a game, share the link, play side-by-side. No accounts, no clocks, no fuss.
          </p>
          <button
            className="mt-5 rounded-full bg-[var(--accent)] px-6 min-h-[2.75rem] text-sm font-semibold text-white"
            onClick={handleNewGame}
          >
            Create game
          </button>
        </div>
      </div>
    )
  }

  const isPlayer = yourColor === 'w' || yourColor === 'b'
  const isYourTurn = isPlayer && chess.turn() === yourColor && !gameOver
  const boardFlipped = flipped !== (yourColor === 'b')
  const status: GameStatus =
    !gameOver ? 'playing'
    : gameOver.reason === 'checkmate' ? 'checkmate'
    : gameOver.reason === 'stalemate' ? 'stalemate'
    : gameOver.reason === 'resigned' ? 'resigned'
    : 'draw'

  return (
    <div className="flex flex-col gap-1 landscape:flex-row landscape:gap-3 lg:flex-row lg:gap-6 h-full overflow-hidden">
      <div className="flex flex-col gap-1 lg:gap-2 landscape:w-[min(55%,560px)] lg:w-[min(60%,560px)] min-h-0 shrink-0">
        <PlayerRow
          variant="opponent"
          kingGlyph={yourColor === 'w' ? '♚' : '♔'}
          label={opponentConnected ? 'Opponent' : 'Waiting for opponent...'}
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
          label={yourColor === 'spectator' ? 'Spectating' : `You (${yourColor === 'w' ? 'White' : 'Black'})`}
          right={isYourTurn && (
            <span className="ml-1 rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--success)]">
              Your turn
            </span>
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5 lg:gap-3 flex-1 lg:min-w-[240px] min-h-0 min-w-0 overflow-y-auto">
        {shareUrl && !opponentConnected && (
          <div className="rounded-[1rem] border border-[var(--accent)]/30 bg-[var(--glass-soft)] p-3 text-sm">
            <div className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
              Share this link
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 truncate rounded-[0.5rem] border border-[var(--line)] bg-[var(--glass)] px-2 py-1.5 text-xs text-[var(--ink)]"
                onClick={(e) => e.currentTarget.select()}
              />
              <button
                className="rounded-[0.5rem] bg-[var(--accent)] px-3 min-h-[2.25rem] text-xs font-semibold text-white"
                onClick={copyShareUrl}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-1.5 shrink-0">
          <ActionButton onClick={handleNewGame}>New Game</ActionButton>
          <ActionButton onClick={onFlip}>Flip</ActionButton>
          {isPlayer && !gameOver && (
            <ActionButton onClick={handleResign}>Resign</ActionButton>
          )}
          {gameOver && isPlayer && (
            <ActionButton onClick={handleRematch}>Rematch</ActionButton>
          )}
        </div>

        <div className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass-soft)] px-3 py-2 text-xs">
          <span className="font-bold text-[var(--ink)]">Status:</span>{' '}
          <span className="text-[var(--muted)]">
            {connectionState === 'connecting' && 'Connecting...'}
            {connectionState === 'open' && (opponentConnected ? 'Connected · 2 players' : 'Connected · waiting')}
            {connectionState === 'closed' && 'Disconnected · reconnecting...'}
            {connectionState === 'error' && 'Connection error'}
          </span>
        </div>

        {error && (
          <div className="rounded-[0.75rem] border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <GameOverBanner
          status={status}
          playerLost={!!gameOver && gameOver.winner !== null && gameOver.winner !== yourColor}
          onPlayAgain={handleRematch}
        />

        {/* Post-game review CTA. Shown when game is over and not yet analyzed. */}
        {gameOver && isPlayer && Object.keys(analyses).length === 0 && !analyzing && (
          <button
            type="button"
            onClick={runAnalysis}
            className="rounded-[0.75rem] border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20"
          >
            Analyze game · review your moves
          </button>
        )}

        {analyzing && (
          <div className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass-soft)] px-3 py-2 text-sm">
            <div className="mb-1 text-[var(--muted)]">Analyzing... {analyzeProgress}%</div>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--glass)]">
              <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${analyzeProgress}%` }} />
            </div>
          </div>
        )}

        {Object.keys(analyses).length > 0 && isPlayer && (
          <GameSummary
            analyses={analyses}
            history={chess.history()}
            playerColor={yourColor as 'w' | 'b'}
            onReviewMove={(idx) => setReviewMoveIndex(idx)}
          />
        )}

        {gameOver && chess.history().length > 0 && (
          <button
            type="button"
            onClick={exportPgn}
            className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass)] px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)]"
          >
            {pgnCopied ? 'PGN copied ✓' : 'Copy PGN'}
          </button>
        )}

        <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] p-3">
          {opening && (
            <div className="mb-2 flex items-baseline gap-2 border-b border-[var(--line)] pb-2">
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Opening</span>
              <span className="text-xs font-semibold text-[var(--ink)]">{opening}</span>
            </div>
          )}
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
              {inReview ? `Reviewing move ${Math.floor((reviewMoveIndex ?? 0) / 2) + 1}${(reviewMoveIndex ?? 0) % 2 === 0 ? ' (white)' : ' (black)'}` : 'Moves'}
            </div>
            {chess.history().length > 0 && (
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={prevReview}
                  disabled={reviewMoveIndex === 0}
                  className="rounded-[0.25rem] border border-[var(--line)] bg-[var(--glass)] px-2 py-0.5 text-xs font-mono text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-30"
                  title="Previous move"
                >‹</button>
                <button
                  type="button"
                  onClick={nextReview}
                  disabled={!inReview}
                  className="rounded-[0.25rem] border border-[var(--line)] bg-[var(--glass)] px-2 py-0.5 text-xs font-mono text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-30"
                  title="Next move"
                >›</button>
                {inReview && (
                  <button
                    type="button"
                    onClick={exitReview}
                    className="rounded-[0.25rem] border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20"
                    title="Exit review, return to live game"
                  >Live</button>
                )}
              </div>
            )}
          </div>
          <MoveList
            history={chess.history()}
            analyses={analyses}
            activeReviewMove={reviewMoveIndex}
            onJumpToMove={(idx) => setReviewMoveIndex(idx)}
          />
        </div>
      </div>
    </div>
  )
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass)] px-3 min-h-[2.75rem] min-w-[2.75rem] text-xs font-semibold text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)]"
      onClick={onClick}
    >
      {children}
    </button>
  )
}
