import { useAuth } from '@progamestore/games'
import type { OnlineUser, MatchRecord } from '../types.ts'

interface LobbyViewProps {
  onlineUsers: OnlineUser[]
  history: MatchRecord[]
  connected: boolean
  onChallenge: (userId: string) => void
  onCreateGame: () => void
}

export function LobbyView({
  onlineUsers,
  history,
  connected,
  onChallenge,
  onCreateGame,
}: LobbyViewProps) {
  const { user, signIn } = useAuth()

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4 opacity-80">♟</div>
          <h2 className="text-lg font-bold text-[var(--ink)]">Play Chess Online</h2>
          <p className="mt-1.5 text-sm text-[var(--muted)] leading-relaxed">
            Challenge players, track your games, play multiple matches at once.
          </p>
          <button
            className="mt-5 w-full rounded-[0.75rem] bg-[var(--accent)] px-6 min-h-[3rem] text-sm font-bold text-white shadow-md hover:brightness-110 transition"
            onClick={signIn}
          >
            Sign in with Google
          </button>
          <button
            className="mt-2.5 w-full rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass)] px-5 min-h-[2.75rem] text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--glass-hover)] transition"
            onClick={onCreateGame}
          >
            Play as guest
          </button>
          <p className="mt-4 text-[0.65rem] text-[var(--muted)]">
            Want solo play?{' '}
            <a href="https://chess.freegamestore.online" target="_blank" rel="noopener" className="text-[var(--accent)] underline">
              Free Chess
            </a>{' '}
            has AI + puzzles.
          </p>
        </div>
      </div>
    )
  }

  const onlineOpponents = history
    .map(m => m.opponent)
    .filter((opp, i, arr) => arr.findIndex(o => o.id === opp.id) === i)
    .map(opp => ({
      ...opp,
      isOnline: onlineUsers.some(u => u.id === opp.id),
    }))

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto px-2 py-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[var(--success)]' : 'bg-red-400 animate-pulse'}`} />
          {connected ? 'Online' : 'Connecting...'}
        </div>
        <button
          type="button"
          onClick={onCreateGame}
          className="rounded-[0.5rem] bg-[var(--accent)] px-3 py-1.5 text-[0.65rem] font-bold text-white hover:brightness-110 transition"
        >
          + New Game
        </button>
      </div>

      <section>
        <SectionHeader label="Online Now" count={onlineUsers.length} />
        {onlineUsers.length === 0 ? (
          <div className="rounded-[0.75rem] border border-dashed border-[var(--line)] py-6 text-center">
            <div className="text-2xl mb-1.5 opacity-40">♟</div>
            <p className="text-xs text-[var(--muted)]">No one else online yet</p>
            <p className="text-[0.6rem] text-[var(--muted)] mt-0.5">Share a game link to invite someone</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {onlineUsers.map(u => (
              <UserCard key={u.id} name={u.name} avatar={u.avatar} onAction={() => onChallenge(u.id)} actionLabel="Challenge" />
            ))}
          </div>
        )}
      </section>

      {onlineOpponents.length > 0 && (
        <section>
          <SectionHeader label="Past Opponents" />
          <div className="flex flex-col gap-1.5">
            {onlineOpponents.map(opp => (
              <div
                key={opp.id}
                className="flex items-center gap-2.5 rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass-soft)] px-3 py-2"
              >
                <div className="relative shrink-0">
                  <Avatar name={opp.name} src={opp.avatar} size={28} />
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--paper)] ${opp.isOnline ? 'bg-[var(--success)]' : 'bg-[var(--muted)]/30'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[var(--ink)] truncate">{opp.name}</div>
                  <div className="text-[0.6rem] text-[var(--muted)]">{opp.isOnline ? 'Online' : 'Offline'}</div>
                </div>
                {opp.isOnline && (
                  <button
                    type="button"
                    onClick={() => onChallenge(opp.id)}
                    className="shrink-0 rounded-[0.5rem] border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2.5 py-1.5 text-[0.6rem] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition"
                  >
                    Rematch
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <SectionHeader label="Recent Games" />
          <div className="flex flex-col gap-1">
            {history.slice(0, 10).map(m => {
              const won = m.winner === m.yourColor
              const lost = m.winner !== null && m.winner !== m.yourColor
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-[0.5rem] border border-[var(--line)] bg-[var(--glass)] px-3 py-2"
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.55rem] font-black ${
                    won ? 'bg-[var(--success)]/15 text-[var(--success)]'
                    : lost ? 'bg-red-400/15 text-red-400'
                    : 'bg-[var(--muted)]/15 text-[var(--muted)]'
                  }`}>
                    {won ? 'W' : lost ? 'L' : 'D'}
                  </span>
                  <span className="text-xs text-[var(--ink)] truncate flex-1">
                    vs {m.opponent.name}
                  </span>
                  <span className="text-[0.6rem] text-[var(--muted)] tabular-nums">
                    {m.moveCount}m
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <h3 className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)] mb-2">
      {label}{count !== undefined && <span className="ml-1 text-[var(--ink)]">{count}</span>}
    </h3>
  )
}

function Avatar({ name, src, size = 28 }: { name: string; src?: string; size?: number }) {
  if (src) {
    return <img src={src} alt="" className="rounded-full shrink-0 object-cover" style={{ width: size, height: size }} />
  }
  return (
    <div
      className="rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-xs font-bold text-[var(--accent)] shrink-0"
      style={{ width: size, height: size }}
    >
      {name[0]?.toUpperCase()}
    </div>
  )
}

function UserCard({ name, avatar, onAction, actionLabel }: { name: string; avatar?: string; onAction: () => void; actionLabel: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass-soft)] px-3 py-2">
      <Avatar name={name} src={avatar} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-[var(--ink)] truncate">{name.split(' ')[0]}</div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 rounded-[0.5rem] bg-[var(--accent)] px-2.5 py-1.5 text-[0.6rem] font-bold text-white hover:brightness-110 transition"
      >
        {actionLabel}
      </button>
    </div>
  )
}
