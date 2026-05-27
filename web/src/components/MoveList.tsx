import React, { useEffect, useRef } from 'react'

interface MoveListProps {
  history: string[]
  analyses?: Record<number, unknown>
  onJumpToMove?: (moveIndex: number) => void
  activeReviewMove?: number | null
}

export function MoveList({ history, onJumpToMove, activeReviewMove }: MoveListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [history.length])

  if (history.length === 0) {
    return (
      <div className="text-center text-sm text-[var(--muted)] py-6">
        No moves yet
      </div>
    )
  }

  const entries: React.ReactNode[] = []

  for (let i = 0; i < history.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1
    const white = history[i]
    const black = history[i + 1]

    entries.push(
      <div key={`move-${moveNum}`} className="flex items-baseline gap-1.5 py-0.5">
        <span className="w-6 text-right text-[var(--muted)] text-xs shrink-0 font-mono">{moveNum}.</span>
        <MoveCell move={white} onClick={onJumpToMove ? () => onJumpToMove(i) : undefined} active={activeReviewMove === i} />
        {black && <MoveCell move={black} onClick={onJumpToMove ? () => onJumpToMove(i + 1) : undefined} active={activeReviewMove === i + 1} />}
      </div>
    )
  }

  return (
    <div className="space-y-0.5 overflow-y-auto lg:max-h-[calc(100dvh-24rem)]">
      {entries}
      <div ref={bottomRef} />
    </div>
  )
}

function MoveCell({ move, onClick, active }: { move: string; onClick?: () => void; active?: boolean }) {
  const activeStyle = active ? 'bg-[var(--accent)]/15 rounded-[0.25rem]' : ''

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-16 text-left text-sm font-mono font-semibold px-1 ${activeStyle} hover:bg-[var(--glass-hover)] rounded-[0.25rem]`}
      >
        {move}
      </button>
    )
  }

  return (
    <span className={`w-16 text-sm font-mono font-semibold px-1 ${activeStyle}`}>
      {move}
    </span>
  )
}
