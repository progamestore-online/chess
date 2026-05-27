import React, { Fragment } from 'react'
import type { GameSlot } from '../types.ts'

interface ActiveGamesStripProps {
  games: GameSlot[]
  activeGameId: string | null
  onSwitch: (roomId: string) => void
  onRemove: (roomId: string) => void
}

const PIECE_MAP: Record<string, string> = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
}

function MiniBoard({ fen }: { fen: string }) {
  const rows = fen.split(' ')[0].split('/')

  return (
    <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
      {rows.map((row, r) => {
        const cells: React.ReactNode[] = []
        let col = 0
        for (const ch of row) {
          if (ch >= '1' && ch <= '8') {
            for (let i = 0; i < parseInt(ch); i++) {
              const light = (r + col) % 2 === 0
              cells.push(
                <div key={`${r}-${col}`} className={light ? 'bg-[var(--glass)]' : 'bg-[var(--line)]'} />
              )
              col++
            }
          } else {
            const light = (r + col) % 2 === 0
            cells.push(
              <div key={`${r}-${col}`} className={`flex items-center justify-center ${light ? 'bg-[var(--glass)]' : 'bg-[var(--line)]'}`}>
                <span className="text-[0.35rem] leading-none select-none">{PIECE_MAP[ch] ?? ''}</span>
              </div>
            )
            col++
          }
        }
        return <Fragment key={r}>{cells}</Fragment>
      })}
    </div>
  )
}

export function ActiveGamesStrip({ games, activeGameId, onSwitch, onRemove }: ActiveGamesStripProps) {
  if (games.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {games.map(game => (
        <div
          key={game.roomId}
          className={`group relative flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-lg border-2 cursor-pointer transition-all ${
            game.roomId === activeGameId
              ? 'border-[var(--accent)] shadow-md'
              : 'border-[var(--line)] hover:border-[var(--muted)]'
          } ${game.gameOver ? 'opacity-50' : ''}`}
          onClick={() => onSwitch(game.roomId)}
        >
          <div className="w-full h-full rounded-md overflow-hidden">
            <MiniBoard fen={game.fen} />
          </div>

          {game.isYourTurn && !game.gameOver && (
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--success)] border border-[var(--paper)]" />
          )}

          {game.gameOver && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-[var(--paper)]/60">
              <span className="text-xs">✓</span>
            </div>
          )}

          <button
            type="button"
            className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-[var(--paper)] border border-[var(--line)] flex items-center justify-center text-[0.5rem] text-[var(--muted)] hover:text-[var(--ink)] opacity-0 group-hover:opacity-100 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onRemove(game.roomId) }}
          >
            ×
          </button>

          <div className="absolute -bottom-4 left-0 right-0 text-center truncate text-[0.5rem] text-[var(--muted)] hidden sm:block">
            {game.opponentName?.split(' ')[0] ?? 'Game'}
          </div>
        </div>
      ))}
    </div>
  )
}
