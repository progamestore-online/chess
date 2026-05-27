import type { ReactNode } from 'react'

interface PlayerRowProps {
  kingGlyph: string
  label: string
  variant: 'opponent' | 'player'
  avatar?: string
  right?: ReactNode
}

export function PlayerRow({ kingGlyph, label, variant, avatar, right }: PlayerRowProps) {
  const avatarBg = variant === 'opponent' ? 'bg-[var(--glass)]' : 'bg-[var(--accent)]/20'
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
      {right}
    </div>
  )
}
