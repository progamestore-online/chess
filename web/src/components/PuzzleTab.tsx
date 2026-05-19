import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Board } from './Board.tsx'
import type { Puzzle, PuzzleStatus } from '../types.ts'

const SOLVED_KEY = 'freechess-puzzles-solved'

interface PuzzleTabProps {
  flipped: boolean
  onFlip: () => void
}

export function PuzzleTab({ flipped, onFlip }: PuzzleTabProps) {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null)
  const [daily, setDaily] = useState<Puzzle | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [puzzleIdx, setPuzzleIdx] = useState<number | 'daily' | null>(null)
  const [chess] = useState(() => new Chess())
  const [fen, setFen] = useState(chess.fen())
  const [status, setStatus] = useState<PuzzleStatus>('playing')
  const [moveIndex, setMoveIndex] = useState(0)
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [feedback, setFeedback] = useState<string>('')
  const [solved, setSolved] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(SOLVED_KEY) || '{}') } catch { return {} }
  })
  const opponentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load bundled puzzles + try Lichess daily
  useEffect(() => {
    fetch('/puzzles.json')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: Puzzle[]) => setPuzzles(data))
      .catch(e => setLoadError(`Couldn't load puzzles (${e}). Refresh to retry.`))

    fetch('https://lichess.org/api/puzzle/daily')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.puzzle && d?.game) setDaily(lichessDailyToPuzzle(d)) })
      .catch(() => {})
  }, [])

  const currentPuzzle: Puzzle | null = useMemo(() => {
    if (puzzleIdx === 'daily') return daily
    if (puzzleIdx === null || !puzzles) return null
    return puzzles[puzzleIdx] ?? null
  }, [puzzleIdx, puzzles, daily])

  const solutionMoves = useMemo(() => currentPuzzle?.moves.split(' ') ?? [], [currentPuzzle])
  // The first move in the list is the opponent's setup; user plays moves at odd indices.
  const userColor: 'w' | 'b' = useMemo(() => {
    if (!currentPuzzle) return 'w'
    // FEN side-to-move is the opponent (they make the first move); user is the OTHER color.
    const sideToMove = currentPuzzle.fen.split(' ')[1] as 'w' | 'b'
    return sideToMove === 'w' ? 'b' : 'w'
  }, [currentPuzzle])

  // Load puzzle into the board
  useEffect(() => {
    if (!currentPuzzle) return
    chess.load(currentPuzzle.fen)
    setFen(chess.fen())
    setMoveIndex(0)
    setStatus('playing')
    setLastMove(null)
    setSelectedSquare(null)
    setFeedback('')

    // Auto-play opponent's setup move after a short pause
    if (opponentTimer.current) clearTimeout(opponentTimer.current)
    opponentTimer.current = setTimeout(() => {
      const setup = solutionMoves[0]
      if (!setup) return
      const move = applyUci(chess, setup)
      if (move) {
        setFen(chess.fen())
        setLastMove({ from: move.from as Square, to: move.to as Square })
        setMoveIndex(1)
        setFeedback(`${userColor === 'w' ? 'White' : 'Black'} to move`)
      }
    }, 600)

    return () => { if (opponentTimer.current) clearTimeout(opponentTimer.current) }
  }, [currentPuzzle, chess, solutionMoves, userColor])

  const handleMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    if (status !== 'playing' || !currentPuzzle) return false
    if (chess.turn() !== userColor) return false

    const expectedUci = solutionMoves[moveIndex]
    if (!expectedUci) return false

    const userUci = `${from}${to}${promotion ?? ''}`
    // Lichess solutions accept any move that reaches mate when the position is mate-in-one,
    // but for simplicity here we require the exact UCI match.
    if (userUci !== expectedUci && !sameDestinationMate(chess, from, to, promotion)) {
      // Wrong move — animate the attempt, then revert
      const attempted = applyUci(chess, userUci)
      if (attempted) {
        setFen(chess.fen())
        setLastMove({ from: attempted.from as Square, to: attempted.to as Square })
        setFeedback('Not the right move. Try again.')
        setTimeout(() => {
          chess.undo()
          setFen(chess.fen())
          setLastMove(null)
        }, 700)
      }
      return false
    }

    // Correct move
    const userMove = applyUci(chess, userUci)
    if (!userMove) return false
    setFen(chess.fen())
    setLastMove({ from: userMove.from as Square, to: userMove.to as Square })
    setSelectedSquare(null)

    const nextIdx = moveIndex + 1
    if (nextIdx >= solutionMoves.length) {
      // Solved!
      setStatus('solved')
      setFeedback(`Solved! Rating ${currentPuzzle.rating}.`)
      const next = { ...solved, [currentPuzzle.id]: true }
      setSolved(next)
      try { localStorage.setItem(SOLVED_KEY, JSON.stringify(next)) } catch {}
      return true
    }

    // Auto-play opponent's reply
    if (opponentTimer.current) clearTimeout(opponentTimer.current)
    opponentTimer.current = setTimeout(() => {
      const reply = solutionMoves[nextIdx]
      const replyMove = applyUci(chess, reply)
      if (replyMove) {
        setFen(chess.fen())
        setLastMove({ from: replyMove.from as Square, to: replyMove.to as Square })
        setMoveIndex(nextIdx + 1)
        setFeedback(`${userColor === 'w' ? 'White' : 'Black'} to move`)
      }
    }, 400)

    setMoveIndex(nextIdx)
    return true
  }, [chess, currentPuzzle, moveIndex, solutionMoves, status, userColor, solved])

  const pickRandom = useCallback(() => {
    if (!puzzles || puzzles.length === 0) return
    const unsolved = puzzles.map((_, i) => i).filter(i => !solved[puzzles[i].id])
    const pool = unsolved.length > 0 ? unsolved : puzzles.map((_, i) => i)
    setPuzzleIdx(pool[Math.floor(Math.random() * pool.length)])
  }, [puzzles, solved])

  const showHint = useCallback(() => {
    const expected = solutionMoves[moveIndex]
    if (!expected) return
    setSelectedSquare(expected.slice(0, 2) as Square)
    setFeedback(`Hint: move the piece on ${expected.slice(0, 2)}.`)
  }, [moveIndex, solutionMoves])

  // Initial pick
  useEffect(() => {
    if (puzzleIdx === null && puzzles && puzzles.length > 0) pickRandom()
  }, [puzzleIdx, puzzles, pickRandom])

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] p-6 text-sm text-[var(--muted)]">
          {loadError}
        </div>
      </div>
    )
  }

  if (!puzzles || !currentPuzzle) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-sm text-[var(--muted)] animate-pulse">Loading puzzles...</div>
      </div>
    )
  }

  const solvedCount = Object.keys(solved).length
  const totalCount = puzzles.length

  return (
    <div className="flex flex-col gap-1 landscape:flex-row landscape:gap-3 lg:flex-row lg:gap-6 h-full overflow-hidden">
      <div className="flex flex-col gap-1 lg:gap-2 landscape:w-[min(55%,560px)] lg:w-[min(60%,560px)] min-h-0 shrink-0">
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-semibold text-[var(--ink)] lg:text-sm">
            Puzzle #{currentPuzzle.id} · Rating {currentPuzzle.rating}
          </span>
          {puzzleIdx === 'daily' && (
            <span className="ml-1 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--accent)]">
              Daily
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0">
          <Board
            chess={chess}
            flipped={flipped !== (userColor === 'b')}
            playerColor={userColor}
            onMove={handleMove}
            lastMove={lastMove}
            selectedSquare={selectedSquare}
            onSquareClick={(sq) => setSelectedSquare(sq)}
          />
        </div>

        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-semibold text-[var(--ink)] lg:text-sm">
            You ({userColor === 'w' ? 'White' : 'Black'})
          </span>
          {status === 'solved' && (
            <span className="ml-1 rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--success)]">
              Solved
            </span>
          )}
        </div>

        <div suppressHydrationWarning>
          {/* Used by /qa to inspect fen — no UX impact */}
          <span className="sr-only" data-fen={fen} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 lg:gap-3 flex-1 lg:min-w-[240px] min-h-0 min-w-0 overflow-y-auto">
        <div className="flex gap-1.5 overflow-x-auto shrink-0">
          <ActionButton onClick={pickRandom}>Next Puzzle</ActionButton>
          <ActionButton onClick={showHint} disabled={status !== 'playing'}>Hint</ActionButton>
          <ActionButton onClick={onFlip}>Flip</ActionButton>
          {daily && (
            <ActionButton onClick={() => setPuzzleIdx('daily')}>Today's Puzzle</ActionButton>
          )}
        </div>

        {feedback && (
          <div className={`rounded-[0.75rem] border px-3 py-2 text-sm ${
            status === 'solved'
              ? 'border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]'
              : 'border-[var(--line)] bg-[var(--glass-soft)] text-[var(--ink)]'
          }`}>
            {feedback}
          </div>
        )}

        <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] p-3 text-xs text-[var(--muted)]">
          <div className="mb-1 font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Themes</div>
          <div className="flex flex-wrap gap-1.5">
            {currentPuzzle.themes.map(t => (
              <span key={t} className="rounded-full bg-[var(--glass)] px-2 py-0.5 text-[0.65rem] text-[var(--ink)]">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] p-3 text-xs text-[var(--muted)]">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-[0.15em]">Progress</span>
            <span className="text-[var(--ink)]">{solvedCount} / {totalCount}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--glass)]">
            <div
              className="h-full bg-[var(--accent)] transition-all"
              style={{ width: `${(solvedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>

        <div className="text-[0.65rem] text-[var(--muted)]">
          Puzzles from <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noopener" className="underline">Lichess</a> (CC0).
        </div>
      </div>
    </div>
  )
}

function ActionButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass)] px-3 min-h-[2.75rem] min-w-[2.75rem] text-xs font-semibold text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)] disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

// Apply a UCI move to a chess.js instance. Returns the Move object or null on failure.
function applyUci(chess: Chess, uci: string) {
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.length > 4 ? uci[4] : undefined
  try {
    return chess.move({ from, to, promotion })
  } catch {
    return null
  }
}

// Mate-in-one tolerance: if the user's move delivers checkmate and the expected move also did,
// accept it as correct (Lichess records one specific move but mate has multiple solutions).
function sameDestinationMate(chess: Chess, from: Square, to: Square, promotion?: string): boolean {
  const before = chess.fen()
  try {
    const m = chess.move({ from, to, promotion })
    if (!m) return false
    const isMate = chess.isCheckmate()
    chess.load(before)
    return isMate
  } catch {
    chess.load(before)
    return false
  }
}

interface LichessDaily {
  puzzle: { id: string; rating: number; themes: string[]; solution: string[]; initialPly: number }
  game: { pgn: string; clock: string; rated: boolean; players: unknown[]; perf: unknown }
}

function lichessDailyToPuzzle(d: LichessDaily): Puzzle | null {
  // Lichess daily returns the GAME (PGN up to and including the puzzle's setup move).
  // We need the FEN *before* the setup move. Replay PGN, undo last, get FEN.
  try {
    const chess = new Chess()
    chess.loadPgn(d.game.pgn)
    // initialPly = the ply at which the puzzle starts (0-indexed). Move number = floor(initialPly/2)+1.
    // The position at initialPly is the position AFTER the setup move. We want BEFORE — so undo once.
    chess.undo()
    const fen = chess.fen()
    // Reconstruct UCI solution prefixed with the setup move (last move of the PGN)
    const history = new Chess()
    history.loadPgn(d.game.pgn)
    const allMoves = history.history({ verbose: true })
    const setupMove = allMoves[allMoves.length - 1]
    const setupUci = `${setupMove.from}${setupMove.to}${setupMove.promotion ?? ''}`
    return {
      id: d.puzzle.id,
      fen,
      moves: [setupUci, ...d.puzzle.solution].join(' '),
      rating: d.puzzle.rating,
      themes: d.puzzle.themes,
    }
  } catch {
    return null
  }
}
