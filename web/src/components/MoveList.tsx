import React, { useEffect, useRef } from 'react'
import type { MoveAnalysis } from '../types.ts'

interface MoveListProps {
  history: string[]
  analyses: Record<number, MoveAnalysis>
  onShowAlternative?: (moveIndex: number, analysis: MoveAnalysis) => void
  activeAlternative?: number | null
  // Optional review-mode props. When onJumpToMove is provided, move cells
  // become clickable and the one at activeReviewMove (if any) is highlighted.
  onJumpToMove?: (moveIndex: number) => void
  activeReviewMove?: number | null
}

const CATEGORY_COLORS: Record<MoveAnalysis['category'], string> = {
  brilliant: 'text-[#1bada6]',
  great: 'text-[var(--sky)]',
  good: 'text-[var(--ink)]',
  inaccuracy: 'text-[var(--warning)]',
  mistake: 'text-[#e87040]',
  blunder: 'text-[var(--error)]',
}

const CATEGORY_BG: Record<MoveAnalysis['category'], string> = {
  brilliant: 'bg-[#1bada6]/10 border-[#1bada6]/20',
  great: 'bg-[var(--sky)]/10 border-[var(--sky)]/20',
  good: '',
  inaccuracy: 'bg-[var(--warning)]/8 border-[var(--warning)]/20',
  mistake: 'bg-[#e87040]/8 border-[#e87040]/20',
  blunder: 'bg-[var(--error)]/8 border-[var(--error)]/20',
}

const CATEGORY_SYMBOLS: Record<MoveAnalysis['category'], string> = {
  brilliant: '!!',
  great: '!',
  good: '',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
}

const CATEGORY_LABELS: Record<MoveAnalysis['category'], string> = {
  brilliant: 'Brilliant',
  great: 'Great move',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

export function MoveList({ history, analyses, onShowAlternative, activeAlternative, onJumpToMove, activeReviewMove }: MoveListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [history.length])

  if (history.length === 0) {
    return (
      <div className="text-center text-sm text-[var(--muted)] py-6">
        No moves yet. Make your first move!
      </div>
    )
  }

  const entries: React.ReactNode[] = []

  for (let i = 0; i < history.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1
    const white = history[i]
    const black = history[i + 1]
    const whiteAnalysis = analyses[i]
    const blackAnalysis = analyses[i + 1]

    entries.push(
      <div key={`move-${moveNum}`} className="flex items-baseline gap-1.5 py-0.5">
        <span className="w-6 text-right text-[var(--muted)] text-xs shrink-0 font-mono">{moveNum}.</span>
        <MoveCell move={white} analysis={whiteAnalysis} onClick={onJumpToMove ? () => onJumpToMove(i) : undefined} active={activeReviewMove === i} />
        {black && <MoveCell move={black} analysis={blackAnalysis} onClick={onJumpToMove ? () => onJumpToMove(i + 1) : undefined} active={activeReviewMove === i + 1} />}
      </div>
    )

    if (whiteAnalysis && whiteAnalysis.category !== 'good') {
      entries.push(
        <AnalysisRow
          key={`analysis-w-${moveNum}`}
          analysis={whiteAnalysis}
          active={activeAlternative === i}
          onClick={() => onShowAlternative?.(i, whiteAnalysis)}
        />
      )
    }

    if (blackAnalysis && blackAnalysis.category !== 'good') {
      entries.push(
        <AnalysisRow
          key={`analysis-b-${moveNum}`}
          analysis={blackAnalysis}
          active={activeAlternative === (i + 1)}
          onClick={() => onShowAlternative?.(i + 1, blackAnalysis)}
        />
      )
    }
  }

  return (
    <div className="space-y-0.5 overflow-y-auto lg:max-h-[calc(100dvh-24rem)]">
      {entries}
      <div ref={bottomRef} />
    </div>
  )
}

function MoveCell({ move, analysis, onClick, active }: { move: string; analysis?: MoveAnalysis; onClick?: () => void; active?: boolean }) {
  const color = analysis ? CATEGORY_COLORS[analysis.category] : ''
  const symbol = analysis ? CATEGORY_SYMBOLS[analysis.category] : ''
  const activeStyle = active ? 'bg-[var(--accent)]/15 rounded-[0.25rem]' : ''

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-16 text-left text-sm font-mono font-semibold px-1 ${color} ${activeStyle} hover:bg-[var(--glass-hover)] rounded-[0.25rem]`}
      >
        {move}{symbol}
      </button>
    )
  }

  return (
    <span className={`w-16 text-sm font-mono font-semibold px-1 ${color} ${activeStyle}`}>
      {move}{symbol}
    </span>
  )
}

function AnalysisRow({ analysis, active, onClick }: { analysis: MoveAnalysis; active: boolean; onClick: () => void }) {
  const bg = CATEGORY_BG[analysis.category]
  const textColor = CATEGORY_COLORS[analysis.category]
  const label = CATEGORY_LABELS[analysis.category]
  const hasBest = analysis.bestMove && analysis.bestMove !== analysis.move

  return (
    <button
      className={`ml-7.5 w-[calc(100%-1.875rem)] text-left rounded-[0.5rem] border px-2.5 py-1.5 min-h-[2.75rem] text-xs transition-all ${bg || 'border-[var(--line)]'} ${
        active ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--paper)]' : ''
      } ${hasBest ? 'cursor-pointer hover:brightness-110' : ''}`}
      onClick={hasBest ? onClick : undefined}
    >
      <span className={`font-bold ${textColor}`}>{label}: </span>
      <span className="text-[var(--ink)]/80">{analysis.explanation}</span>
      {hasBest && (
        <span className="text-[var(--muted)]">
          {' '}Best was <strong className="text-[var(--ink)]">{analysis.bestMove}</strong>.
          <span className={`ml-1 ${active ? 'text-[var(--accent)]' : 'text-[var(--accent)]/60'}`}>
            {active ? '(showing on board)' : 'Tap to see'}
          </span>
        </span>
      )}
    </button>
  )
}
