interface EvalBarProps {
  // Stockfish-style centipawn evaluation from white's perspective.
  evaluation: number
}

export function EvalBar({ evaluation }: EvalBarProps) {
  const clamped = Math.max(-2000, Math.min(2000, evaluation))
  const whitePercent = 50 + (clamped / 2000) * 50
  // Stockfish reports mate as ±99999-ish (huge centipawn). Show "M" instead of "+999.99".
  const display =
    evaluation >= 10000 ? '+M' :
    evaluation <= -10000 ? '-M' :
    evaluation > 0 ? `+${(evaluation / 100).toFixed(1)}` : (evaluation / 100).toFixed(1)

  return (
    <div className="w-3 lg:w-4 shrink-0 rounded-full overflow-hidden bg-[var(--board-dark)] relative">
      <div
        className="absolute bottom-0 left-0 right-0 bg-[var(--board-light)] transition-all duration-500"
        style={{ height: `${whitePercent}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[8px] font-bold text-[var(--ink)] mix-blend-difference [writing-mode:vertical-rl] rotate-180">
          {display}
        </span>
      </div>
    </div>
  )
}
