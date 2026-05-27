import { useState } from 'react'
import { Board } from './Board.tsx'
import { GameOverBanner } from './GameOverBanner.tsx'
import { MoveList } from './MoveList.tsx'
import { PlayerRow } from './PlayerRow.tsx'
import type { GameRoomState } from '../hooks/useGameRoom.ts'

interface GameViewProps {
  game: GameRoomState
  flipped: boolean
  onFlip: () => void
  onNewGame: () => void
}

export function GameView({ game, flipped, onFlip, onNewGame }: GameViewProps) {
  const [copied, setCopied] = useState(false)
  const [pgnCopied, setPgnCopied] = useState(false)

  const boardFlipped = flipped !== (game.yourColor === 'b')
  const opColor = game.yourColor === 'w' ? 'b' : 'w'
  const myColor = game.yourColor === 'w' || game.yourColor === 'b' ? game.yourColor : null
  const opponentInfo = game.players[opColor]

  const handleCopyLink = async () => {
    const ok = await game.copyShareUrl()
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500) }
  }

  const handleExportPgn = async () => {
    const ok = await game.exportPgn()
    if (ok) { setPgnCopied(true); setTimeout(() => setPgnCopied(false), 1500) }
  }

  return (
    <div className="flex flex-col gap-1 landscape:flex-row landscape:gap-3 lg:flex-row lg:gap-4 flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-col gap-1 lg:gap-1 landscape:w-[min(55%,560px)] lg:w-auto lg:max-w-[min(60%,560px)] min-h-0 lg:shrink">
        <PlayerRow
          variant="opponent"
          kingGlyph={game.yourColor === 'w' ? '♚' : '♔'}
          label={opponentInfo?.name ?? (game.opponentConnected ? 'Opponent' : 'Waiting for opponent...')}
          avatar={opponentInfo?.avatar}
          clock={game.clocks ? game.clocks[opColor] : undefined}
          clockActive={game.clocks?.running && game.chess.turn() === opColor}
          right={!game.opponentConnected && !game.gameOver && !game.clocks && (
            <span className="ml-auto text-[0.6rem] text-[var(--muted)] animate-pulse">waiting...</span>
          )}
        />

        <div className="flex-1 min-h-0">
          <Board
            chess={game.chess}
            flipped={boardFlipped}
            playerColor={game.isPlayer ? (game.yourColor as 'w' | 'b') : 'w'}
            onMove={game.handleMove}
            lastMove={game.inReview ? game.reviewLastMove : game.lastMove}
            selectedSquare={game.inReview ? null : game.selectedSquare}
            onSquareClick={game.setSelectedSquare}
            previewFen={game.inReview ? game.reviewFen : null}
            previewLabel={game.inReview ? `Move ${Math.floor((game.reviewMoveIndex ?? 0) / 2) + 1}${(game.reviewMoveIndex ?? 0) % 2 === 0 ? '' : '...'}` : ''}
          />
        </div>

        <PlayerRow
          variant="player"
          kingGlyph={game.yourColor === 'w' ? '♔' : game.yourColor === 'b' ? '♚' : '♔'}
          label={
            game.yourColor === 'w' || game.yourColor === 'b'
              ? game.players[game.yourColor]?.name ?? `You (${game.yourColor === 'w' ? 'White' : 'Black'})`
              : 'Spectating'
          }
          avatar={myColor ? game.players[myColor]?.avatar : undefined}
          clock={game.clocks && myColor ? game.clocks[myColor] : undefined}
          clockActive={game.clocks?.running && myColor === game.chess.turn()}
          right={game.isYourTurn && (
            <span className="ml-1 rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[var(--success)]">
              Your turn
            </span>
          )}
        />
      </div>

      <div className="flex flex-col gap-2 lg:gap-3 flex-1 lg:min-w-[240px] min-h-0 min-w-0 overflow-y-auto">
        {game.shareUrl && !game.opponentConnected && (
          <div className="flex items-center gap-1.5 rounded-[0.75rem] border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-2.5 py-2">
            <input readOnly value={game.shareUrl} className="flex-1 truncate bg-transparent text-xs text-[var(--ink)] outline-none" onClick={(e) => e.currentTarget.select()} />
            <button className="shrink-0 rounded-[0.5rem] bg-[var(--accent)] px-3 py-1.5 text-[0.65rem] font-bold text-white hover:brightness-110 transition" onClick={handleCopyLink}>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        )}

        <div className="flex gap-1.5 shrink-0 flex-wrap">
          <Btn variant="primary" onClick={onNewGame}>+ New</Btn>
          <Btn variant="ghost" onClick={onFlip}>Flip</Btn>
          {game.isPlayer && !game.gameOver && <Btn variant="danger" onClick={game.handleResign}>Resign</Btn>}
          {game.gameOver && game.isPlayer && <Btn variant="primary" onClick={game.handleRematch}>Rematch</Btn>}
          {game.gameOver && game.chess.history().length > 0 && <Btn variant="ghost" onClick={handleExportPgn}>{pgnCopied ? 'Copied!' : 'PGN'}</Btn>}
        </div>

        {game.connectionState !== 'open' && game.connectionState !== 'idle' && (
          <div className="flex items-center gap-1.5 text-[0.65rem] text-[var(--muted)]">
            <div className={`w-1.5 h-1.5 rounded-full ${game.connectionState === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
            {game.connectionState === 'connecting' && 'Connecting...'}
            {game.connectionState === 'closed' && 'Reconnecting...'}
            {game.connectionState === 'error' && 'Connection error'}
          </div>
        )}

        {game.error && (
          <div className="rounded-[0.5rem] border border-red-400/20 bg-red-400/5 px-2.5 py-1.5 text-xs text-red-400">{game.error}</div>
        )}

        <GameOverBanner
          status={game.status}
          playerLost={!!game.gameOver && game.gameOver.winner !== null && game.gameOver.winner !== game.yourColor}
          onPlayAgain={game.handleRematch}
        />

        <div className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass-soft)] p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
              {game.inReview ? `Move ${Math.floor((game.reviewMoveIndex ?? 0) / 2) + 1}${(game.reviewMoveIndex ?? 0) % 2 === 0 ? ' (white)' : ' (black)'}` : 'Moves'}
            </div>
            {game.chess.history().length > 0 && (
              <div className="flex gap-0.5">
                <NavBtn onClick={game.prevReview} disabled={game.reviewMoveIndex === 0}>&#8249;</NavBtn>
                <NavBtn onClick={game.nextReview} disabled={!game.inReview}>&#8250;</NavBtn>
                {game.inReview && (
                  <button type="button" onClick={game.exitReview} className="rounded-[0.25rem] bg-[var(--accent)]/10 px-2 py-0.5 text-[0.6rem] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition">
                    Live
                  </button>
                )}
              </div>
            )}
          </div>
          <MoveList history={game.chess.history()} activeReviewMove={game.reviewMoveIndex} onJumpToMove={game.jumpToMove} />
        </div>
      </div>
    </div>
  )
}

function Btn({ children, onClick, variant }: { children: React.ReactNode; onClick: () => void; variant: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-[var(--accent)] text-white hover:brightness-110',
    ghost: 'border border-[var(--line)] bg-[var(--glass)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--glass-hover)]',
    danger: 'border border-red-400/20 bg-red-400/5 text-red-400 hover:bg-red-400/10',
  }
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-[0.5rem] px-3 py-2 text-[0.65rem] font-bold transition ${styles[variant]}`}>
      {children}
    </button>
  )
}

function NavBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="rounded-[0.25rem] border border-[var(--line)] bg-[var(--glass)] w-6 h-6 flex items-center justify-center text-xs font-mono text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-25 transition">
      {children}
    </button>
  )
}
