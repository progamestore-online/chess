import type { Difficulty } from '../types.ts'

interface DifficultyColorPickerProps {
  difficulty: Difficulty
  onDifficultyChange: (d: Difficulty) => void
  playerColor: 'w' | 'b'
  onColorChange: (c: 'w' | 'b') => void
}

const LEVELS: Difficulty[] = [1, 2, 3, 4, 5]

export function DifficultyColorPicker({ difficulty, onDifficultyChange, playerColor, onColorChange }: DifficultyColorPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 shrink-0">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-[var(--muted)]">Difficulty:</span>
        <div className="flex gap-0.5">
          {LEVELS.map(d => (
            <Pill key={d} active={difficulty === d} onClick={() => onDifficultyChange(d)}>{d}</Pill>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-[var(--muted)]">Play as:</span>
        <div className="flex gap-0.5">
          <Pill active={playerColor === 'w'} onClick={() => onColorChange('w')} wide>White</Pill>
          <Pill active={playerColor === 'b'} onClick={() => onColorChange('b')} wide>Black</Pill>
        </div>
      </div>
    </div>
  )
}

function Pill({ active, onClick, wide, children }: { active: boolean; onClick: () => void; wide?: boolean; children: React.ReactNode }) {
  const sizing = wide ? 'px-3 text-sm' : 'px-2 text-xs'
  return (
    <button
      className={`rounded-[0.5rem] min-h-[2.75rem] min-w-[2.75rem] font-semibold ${sizing} ${
        active ? 'bg-[var(--accent)] text-white' : 'bg-[var(--glass)] text-[var(--muted)] hover:bg-[var(--glass-hover)]'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
