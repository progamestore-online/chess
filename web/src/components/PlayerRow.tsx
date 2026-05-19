import type { ReactNode } from 'react'

interface PlayerRowProps {
  // The king glyph to show in the avatar circle (use opposite-color for opponent).
  kingGlyph: string
  label: string
  variant: 'opponent' | 'player'
  right?: ReactNode
}

export function PlayerRow({ kingGlyph, label, variant, right }: PlayerRowProps) {
  const avatarBg = variant === 'opponent' ? 'bg-[var(--glass)]' : 'bg-[var(--accent)]/20'
  return (
    <div className="flex items-center gap-2 px-1">
      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-sm lg:h-7 lg:w-7 lg:text-base ${avatarBg}`}>
        {kingGlyph}
      </div>
      <span className="text-xs font-semibold text-[var(--ink)] lg:text-sm">{label}</span>
      {right}
    </div>
  )
}
