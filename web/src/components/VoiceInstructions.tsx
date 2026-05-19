const COMMANDS: [string, string][] = [
  ['"e4"', 'Pawn to e4'],
  ['"knight f3"', 'Knight to f3'],
  ['"bishop to c4"', 'Bishop to c4'],
  ['"castle kingside"', 'Short castle'],
  ['"takes on d5"', 'Capture on d5'],
  ['"undo"', 'Take back move'],
  ['"new game"', 'Start over'],
]

export function VoiceInstructions() {
  return (
    <div className="space-y-1 rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] p-3 text-[0.7rem] text-[var(--muted)]">
      <div className="font-bold uppercase tracking-[0.15em]">Voice Commands</div>
      {COMMANDS.map(([phrase, meaning]) => (
        <div key={phrase} className="flex justify-between">
          <span>{phrase}</span>
          <span>{meaning}</span>
        </div>
      ))}
    </div>
  )
}
