import type { GameStatus } from '../types.ts'

interface GameOverBannerProps {
  status: GameStatus
  playerLost: boolean
  onPlayAgain: () => void
}

export function GameOverBanner({ status, playerLost, onPlayAgain }: GameOverBannerProps) {
  if (status === 'playing') return null

  const title =
    status === 'checkmate' ? (playerLost ? 'Checkmate — You Lost' : 'Checkmate — You Won!')
    : status === 'stalemate' ? 'Stalemate — Draw'
    : status === 'draw' ? 'Draw'
    : status === 'resigned' ? (playerLost ? 'You Resigned' : 'Opponent Resigned')
    : ''

  return (
    <div className={`rounded-[0.75rem] border p-3 text-center ${
      playerLost
        ? 'border-red-400/20 bg-red-400/5'
        : status === 'stalemate' || status === 'draw'
        ? 'border-[var(--line)] bg-[var(--glass-soft)]'
        : 'border-[var(--success)]/20 bg-[var(--success)]/5'
    }`}>
      <div className={`text-sm font-bold ${
        playerLost ? 'text-red-400' : status === 'stalemate' || status === 'draw' ? 'text-[var(--muted)]' : 'text-[var(--success)]'
      }`}>
        {title}
      </div>
      <button
        className="mt-2 rounded-[0.5rem] bg-[var(--accent)] px-4 py-1.5 text-[0.65rem] font-bold text-white hover:brightness-110 transition"
        onClick={onPlayAgain}
      >
        Rematch
      </button>
    </div>
  )
}
