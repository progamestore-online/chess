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
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] p-6 text-center">
          <h2 className="text-xl font-bold text-[var(--ink)]">Multiplayer Chess</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Sign in to see who's online, challenge opponents, and track your match history.
          </p>
          <button
            className="mt-5 rounded-full bg-[var(--accent)] px-6 min-h-[2.75rem] text-sm font-semibold text-white"
            onClick={signIn}
          >
            Sign in
          </button>
          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <p className="text-xs text-[var(--muted)] mb-2">Or play without an account:</p>
            <button
              className="rounded-full border border-[var(--line)] bg-[var(--glass)] px-5 min-h-[2.5rem] text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
              onClick={onCreateGame}
            >
              Create a game link
            </button>
          </div>
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
    <div className="flex flex-col gap-3 h-full overflow-y-auto p-1">
      {/* Connection status */}
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[var(--success)]' : 'bg-red-400'}`} />
        {connected ? 'Connected to lobby' : 'Connecting...'}
      </div>

      {/* Online Now */}
      <section>
        <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)] mb-2">
          Online Now ({onlineUsers.length})
        </h3>
        {onlineUsers.length === 0 ? (
          <p className="text-sm text-[var(--muted)] italic">No one else is online right now</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {onlineUsers.map(u => (
              <div
                key={u.id}
                className="flex items-center gap-2 rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass-soft)] p-2"
              >
                {u.avatar ? (
                  <img src={u.avatar} alt="" className="w-7 h-7 rounded-full shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-xs font-bold text-[var(--accent)] shrink-0">
                    {u.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[var(--ink)] truncate">{u.name.split(' ')[0]}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onChallenge(u.id)}
                  className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-1 text-[0.6rem] font-bold text-white hover:opacity-90"
                >
                  Play
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Past Opponents */}
      {onlineOpponents.length > 0 && (
        <section>
          <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)] mb-2">
            Past Opponents
          </h3>
          <div className="flex flex-col gap-1.5">
            {onlineOpponents.map(opp => (
              <div
                key={opp.id}
                className="flex items-center gap-2 rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass-soft)] p-2"
              >
                <div className="relative shrink-0">
                  {opp.avatar ? (
                    <img src={opp.avatar} alt="" className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[var(--line)] flex items-center justify-center text-xs font-bold text-[var(--muted)]">
                      {opp.name[0]}
                    </div>
                  )}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[var(--paper)] ${opp.isOnline ? 'bg-[var(--success)]' : 'bg-[var(--muted)]/40'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[var(--ink)] truncate">{opp.name}</div>
                  <div className="text-[0.6rem] text-[var(--muted)]">
                    {opp.isOnline ? 'Online' : 'Offline'}
                  </div>
                </div>
                {opp.isOnline && (
                  <button
                    type="button"
                    onClick={() => onChallenge(opp.id)}
                    className="shrink-0 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2.5 py-1 text-[0.6rem] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20"
                  >
                    Rematch
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Match History */}
      {history.length > 0 && (
        <section>
          <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[var(--muted)] mb-2">
            Recent Games
          </h3>
          <div className="flex flex-col gap-1">
            {history.slice(0, 10).map(m => {
              const won = m.winner === m.yourColor
              const lost = m.winner !== null && m.winner !== m.yourColor
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-[0.5rem] border border-[var(--line)] bg-[var(--glass)] px-2.5 py-1.5"
                >
                  <span className={`text-xs font-bold ${won ? 'text-[var(--success)]' : lost ? 'text-red-400' : 'text-[var(--muted)]'}`}>
                    {won ? 'W' : lost ? 'L' : 'D'}
                  </span>
                  <span className="text-xs text-[var(--ink)] truncate flex-1">
                    vs {m.opponent.name}
                  </span>
                  <span className="text-[0.6rem] text-[var(--muted)]">
                    {m.moveCount} moves · {m.reason}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Create game fallback */}
      <div className="mt-auto pt-3 border-t border-[var(--line)]">
        <button
          type="button"
          onClick={onCreateGame}
          className="w-full rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass)] px-3 min-h-[2.75rem] text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--glass-hover)]"
        >
          Or create a link to share
        </button>
      </div>
    </div>
  )
}
