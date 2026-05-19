import type { MoveAnalysis } from '../types.ts'

interface GameSummaryProps {
  analyses: Record<number, MoveAnalysis>
  history: string[]
  playerColor: 'w' | 'b'
  onReviewMove: (moveIndex: number) => void
}

// Compute "accuracy" as a 0-100 score using a simplified Lichess-style formula:
// 100 - average centipawn loss capped at 1000.
function computeAccuracy(losses: number[]): number {
  if (losses.length === 0) return 100
  const avg = losses.reduce((a, b) => a + b, 0) / losses.length
  const capped = Math.min(1000, avg)
  return Math.max(0, Math.round(100 - capped / 10))
}

export function GameSummary({ analyses, history, playerColor, onReviewMove }: GameSummaryProps) {
  // Index your moves: white = 0,2,4...; black = 1,3,5...
  const myIndexes: number[] = []
  for (let i = playerColor === 'w' ? 0 : 1; i < history.length; i += 2) {
    myIndexes.push(i)
  }

  let inaccuracies = 0
  let mistakes = 0
  let blunders = 0
  let brilliants = 0
  const losses: number[] = []
  let worstSwing = 0
  let worstSwingIdx = -1

  for (const i of myIndexes) {
    const a = analyses[i]
    if (!a) continue
    if (a.category === 'inaccuracy') inaccuracies++
    if (a.category === 'mistake') mistakes++
    if (a.category === 'blunder') blunders++
    if (a.category === 'brilliant') brilliants++
    const moveEval = a.evaluation * (playerColor === 'w' ? 1 : -1)
    const bestMoveEval = a.bestEval * (playerColor === 'w' ? 1 : -1)
    const loss = Math.max(0, bestMoveEval - moveEval)
    losses.push(loss)
    if (loss > worstSwing) {
      worstSwing = loss
      worstSwingIdx = i
    }
  }

  const accuracy = computeAccuracy(losses)
  const analyzedCount = losses.length

  if (analyzedCount === 0) {
    return null
  }

  return (
    <div className="rounded-[1rem] border border-[var(--accent)]/30 bg-[var(--glass-soft)] p-3 text-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Game review</div>
        <div className="text-[0.7rem] text-[var(--muted)]">
          {analyzedCount} move{analyzedCount === 1 ? '' : 's'} analyzed
        </div>
      </div>

      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-[var(--ink)]">{accuracy}%</span>
        <span className="text-xs text-[var(--muted)]">accuracy</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
        <StatCell value={brilliants} label="Brilliant" tone="text-[#1bada6]" />
        <StatCell value={inaccuracies} label="Inacc." tone="text-[var(--warning)]" />
        <StatCell value={mistakes} label="Mistakes" tone="text-[#e87040]" />
        <StatCell value={blunders} label="Blunders" tone="text-[var(--error)]" />
      </div>

      {worstSwingIdx >= 0 && worstSwing >= 100 && (
        <button
          type="button"
          onClick={() => onReviewMove(worstSwingIdx)}
          className="mt-3 w-full rounded-[0.5rem] border border-[var(--line)] bg-[var(--glass)] px-3 py-2 text-left text-xs hover:bg-[var(--glass-hover)]"
        >
          <span className="text-[var(--muted)]">Biggest swing:</span>{' '}
          <span className="font-semibold text-[var(--ink)]">
            move {Math.floor(worstSwingIdx / 2) + 1}
            {worstSwingIdx % 2 === 0 ? '' : '…'}{' '}
            ({history[worstSwingIdx]})
          </span>{' '}
          <span className="text-[var(--muted)]">— jump to review</span>
        </button>
      )}
    </div>
  )
}

function StatCell({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="rounded-[0.5rem] border border-[var(--line)] bg-[var(--glass)] py-1.5">
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
      <div className="text-[0.6rem] text-[var(--muted)] uppercase tracking-wider">{label}</div>
    </div>
  )
}
