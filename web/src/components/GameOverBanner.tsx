import type { GameStatus } from '../types.ts'

interface GameOverBannerProps {
  status: GameStatus
  playerLost: boolean
  onPlayAgain: () => void
}

export function GameOverBanner({ status, playerLost, onPlayAgain }: GameOverBannerProps) {
  if (status === 'playing') return null
  return (
    <div className="rounded-[1rem] border border-[var(--accent)]/30 bg-[var(--accent-gradient)] p-4 text-center">
      <div className="text-lg font-bold text-[var(--ink)]">
        {status === 'checkmate' && (playerLost ? 'You Lost' : 'You Won!')}
        {status === 'stalemate' && 'Stalemate'}
        {status === 'draw' && 'Draw'}
        {status === 'resigned' && (playerLost ? 'You Resigned' : 'Opponent Resigned · You Won!')}
      </div>
      <button
        className="mt-2 rounded-full bg-[var(--accent)] px-6 min-h-[2.75rem] text-sm font-semibold text-white"
        onClick={onPlayAgain}
      >
        Play Again
      </button>
    </div>
  )
}
