import type { Challenge } from '../types.ts'

interface ChallengeNotificationProps {
  challenges: Challenge[]
  onAccept: (id: string) => void
  onDecline: (id: string) => void
}

export function ChallengeNotification({ challenges, onAccept, onDecline }: ChallengeNotificationProps) {
  if (challenges.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {challenges.map(c => (
        <div
          key={c.id}
          className="flex items-center gap-3 rounded-[0.75rem] border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3"
        >
          {c.from.avatar && (
            <img
              src={c.from.avatar}
              alt=""
              className="w-8 h-8 rounded-full border border-[var(--line)]"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[var(--ink)] truncate">
              {c.from.name}
            </div>
            <div className="text-xs text-[var(--muted)]">wants to play chess</div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onAccept(c.id)}
              className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => onDecline(c.id)}
              className="rounded-full border border-[var(--line)] bg-[var(--glass)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
