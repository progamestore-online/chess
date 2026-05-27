import type { ReactNode } from 'react'

interface PlayerRowProps {
  kingGlyph: string
  label: string
  variant: 'opponent' | 'player'
  avatar?: string
  clock?: number | null
  clockActive?: boolean
  right?: ReactNode
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PlayerRow({ kingGlyph, label, variant, avatar, clock, clockActive, right }: PlayerRowProps) {
  const avatarBg = variant === 'opponent' ? 'bg-[var(--glass)]' : 'bg-[var(--accent)]/20'
  const isLow = clock != null && clock < 30
  return (
    <div className="flex items-center gap-2 px-1">
      {avatar ? (
        <img src={avatar} alt="" className="h-6 w-6 rounded-full lg:h-7 lg:w-7 object-cover" />
      ) : (
        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-sm lg:h-7 lg:w-7 lg:text-base ${avatarBg}`}>
          {kingGlyph}
        </div>
      )}
      <span className="text-xs font-semibold text-[var(--ink)] lg:text-sm">{label}</span>
      {clock != null && (
        <span className={`ml-auto font-mono text-xs tabular-nums px-1.5 py-0.5 rounded-[0.25rem] ${
          isLow ? 'bg-red-400/15 text-red-400 font-bold' : clockActive ? 'bg-[var(--glass)] text-[var(--ink)]' : 'text-[var(--muted)]'
        }`}>
          {formatClock(clock)}
        </span>
      )}
      {right}
    </div>
  )
}
