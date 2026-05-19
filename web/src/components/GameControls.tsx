interface GameControlsProps {
  onNewGame: () => void
  onUndo: () => void
  canUndo: boolean
  onFlip: () => void
  onResign?: () => void
  canResign?: boolean
  onHint?: () => void
  canHint?: boolean
  hintLoading?: boolean
  microphoneOn: boolean
  onToggleMic: () => void
}

export function GameControls({ onNewGame, onUndo, canUndo, onFlip, onResign, canResign, onHint, canHint, hintLoading, microphoneOn, onToggleMic }: GameControlsProps) {
  return (
    <div className="flex gap-1.5 landscape:gap-1 overflow-x-auto shrink-0">
      <ControlButton onClick={onNewGame}>New Game</ControlButton>
      <ControlButton onClick={onUndo} disabled={!canUndo}>Undo</ControlButton>
      {onHint && (
        <ControlButton onClick={onHint} disabled={!canHint || hintLoading}>
          {hintLoading ? 'Hint…' : 'Hint'}
        </ControlButton>
      )}
      <ControlButton onClick={onFlip}>Flip</ControlButton>
      {onResign && (
        <button
          className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass)] px-3 min-h-[2.75rem] min-w-[2.75rem] text-xs font-semibold text-[var(--danger,#e85c5c)] hover:bg-[var(--glass-hover)] disabled:opacity-30"
          onClick={onResign}
          disabled={!canResign}
        >
          Resign
        </button>
      )}
      <button
        className={`rounded-[0.75rem] border px-3 min-h-[2.75rem] min-w-[2.75rem] text-xs font-semibold ${
          microphoneOn
            ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
            : 'border-[var(--line)] bg-[var(--glass)] text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)]'
        }`}
        onClick={onToggleMic}
      >
        {microphoneOn ? 'Mic On' : 'Mic Off'}
      </button>
    </div>
  )
}

function ControlButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className="rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass)] px-3 min-h-[2.75rem] min-w-[2.75rem] text-xs font-semibold text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)] disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
