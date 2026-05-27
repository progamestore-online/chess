import React, { Fragment } from 'react'
import type { GameSlot } from '../types.ts'

interface ActiveGamesStripProps {
  games: GameSlot[]
  activeGameId: string | null
  onSwitch: (roomId: string) => void
  onRemove: (roomId: string) => void
}

function StaticBoard({ fen, size }: { fen: string; size: number }) {
  const board = (fen || '').split(' ')[0] || ''
  const rows = board.split('/')
  if (rows.length !== 8) return <div style={{ width: size, height: size }} className="bg-[var(--glass)] rounded-[0.25rem]" />

  const sq = size / 8
  const piecePad = sq * 0.08
  const pieceSize = sq - piecePad * 2

  const elements: React.ReactNode[] = []
  for (let r = 0; r < 8; r++) {
    let col = 0
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < parseInt(ch); i++) {
          const light = (r + col) % 2 === 0
          elements.push(
            <rect key={`sq-${r}-${col}`} x={col * sq} y={r * sq} width={sq} height={sq}
              fill={light ? 'var(--board-light)' : 'var(--board-dark)'} />
          )
          col++
        }
      } else {
        const light = (r + col) % 2 === 0
        const color = ch === ch.toUpperCase() ? 'w' : 'b'
        const type = ch.toLowerCase()
        elements.push(
          <Fragment key={`p-${r}-${col}`}>
            <rect x={col * sq} y={r * sq} width={sq} height={sq}
              fill={light ? 'var(--board-light)' : 'var(--board-dark)'} />
            <image
              href={`/pieces/${color}${type}.svg`}
              x={col * sq + piecePad} y={r * sq + piecePad}
              width={pieceSize} height={pieceSize}
            />
          </Fragment>
        )
        col++
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="rounded-[0.25rem]">
      {elements}
    </svg>
  )
}

export function ActiveGamesStrip({ games, activeGameId, onSwitch, onRemove }: ActiveGamesStripProps) {
  if (games.length === 0) return null

  return (
    <div className="flex gap-2 lg:gap-3 overflow-x-auto pb-1 scrollbar-none">
      {games.map(game => {
        const isActive = game.roomId === activeGameId
        return (
          <div
            key={game.roomId}
            className={`group relative flex-shrink-0 cursor-pointer transition-all
              w-14 h-14 sm:w-16 sm:h-16 lg:w-auto lg:h-auto
              rounded-lg lg:rounded-[0.75rem] border-2 ${
              isActive
                ? 'border-[var(--accent)] shadow-md lg:shadow-lg'
                : 'border-[var(--line)] hover:border-[var(--muted)]'
            } ${game.gameOver ? 'opacity-50' : ''}`}
            onClick={() => onSwitch(game.roomId)}
          >
            {/* Mobile: tiny board */}
            <div className="lg:hidden w-full h-full rounded-md overflow-hidden">
              <StaticBoard fen={game.fen} size={56} />
            </div>

            {/* Desktop: medium board card */}
            <div className="hidden lg:flex flex-col items-center gap-1.5 p-2">
              <div className="flex items-center justify-between w-full px-0.5">
                <span className="text-[0.6rem] font-semibold text-[var(--muted)] truncate max-w-[120px]">
                  vs {game.opponentName?.split(' ')[0] || 'Opponent'}
                </span>
                {game.isYourTurn && !game.gameOver && (
                  <span className="text-[0.5rem] font-bold uppercase text-[var(--success)]">your turn</span>
                )}
                {game.gameOver && (
                  <span className="text-[0.5rem] font-bold uppercase text-[var(--muted)]">done</span>
                )}
              </div>
              <StaticBoard fen={game.fen} size={200} />
            </div>

            {/* Turn dot (mobile only) */}
            {game.isYourTurn && !game.gameOver && (
              <div className="lg:hidden absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--success)] border border-[var(--paper)]" />
            )}

            {/* Game over overlay (mobile only) */}
            {game.gameOver && (
              <div className="lg:hidden absolute inset-0 flex items-center justify-center rounded-md bg-[var(--paper)]/60">
                <span className="text-xs">&#10003;</span>
              </div>
            )}

            {/* Remove button */}
            <button
              type="button"
              className="absolute -top-1.5 -left-1.5 lg:top-1 lg:left-auto lg:-right-1.5 w-4 h-4 lg:w-5 lg:h-5 rounded-full bg-[var(--paper)] border border-[var(--line)] flex items-center justify-center text-[0.5rem] lg:text-xs text-[var(--muted)] hover:text-[var(--ink)] opacity-0 group-hover:opacity-100 transition"
              onClick={(e) => { e.stopPropagation(); onRemove(game.roomId) }}
            >
              &times;
            </button>
          </div>
        )
      })}
    </div>
  )
}
