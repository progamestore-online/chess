import { useState, useEffect, useCallback } from 'react'
import { GameShell, GameTopbar, GameAuth } from '@progamestore/games'
import { MultiplayerTab } from './components/MultiplayerTab.tsx'

function parseRoute(): { gameId: string | null } {
  const path = window.location.pathname
  const gameMatch = path.match(/^\/g\/([a-z0-9]{6,12})$/)
  if (gameMatch) return { gameId: gameMatch[1] }
  return { gameId: null }
}

function RulesPanel() {
  const section = { marginTop: '0.75rem', fontWeight: 700 }
  const list = { margin: '0.25rem 0 0 1.1rem', paddingLeft: 0, listStyleType: 'disc' as const }
  return (
    <div style={{ lineHeight: 1.55 }}>
      <h3 style={{ fontWeight: 700, fontSize: '1.05rem' }}>Multiplayer Chess</h3>
      <p style={{ marginTop: '0.25rem' }}>
        Play chess with friends and strangers. Multiple games at once.
      </p>

      <h4 style={section}>How it works</h4>
      <ul style={list}>
        <li>Sign in to see who's online and challenge them</li>
        <li>Or create a game link and share it with a friend</li>
        <li>Play multiple games simultaneously — switch between them in the strip</li>
        <li>Server validates every move in real time</li>
      </ul>

      <h4 style={section}>Controls</h4>
      <ul style={list}>
        <li>Tap a piece, then tap a destination to move</li>
        <li>Drag and drop works too</li>
        <li>Arrow keys step through the move list</li>
        <li>Resign or start a new game any time</li>
      </ul>

      <h4 style={section}>Solo play</h4>
      <p style={{ marginTop: '0.25rem' }}>
        Want to play against the engine or solve puzzles?{' '}
        <a href="https://chess.freegamestore.online" target="_blank" rel="noopener" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
          Free Chess
        </a>{' '}
        has Stockfish AI, 1000 puzzles, and voice control — all free.
      </p>
    </div>
  )
}

export default function App() {
  const initial = parseRoute()
  const [gameId, setGameId] = useState<string | null>(initial.gameId)
  const [flipped, setFlipped] = useState(false)

  const loadGame = useCallback((id: string) => {
    setGameId(id)
    window.history.pushState(null, '', `/g/${id}`)
  }, [])

  const goToLobby = useCallback(() => {
    setGameId(null)
    window.history.pushState(null, '', '/')
  }, [])

  useEffect(() => {
    const onPop = () => {
      const r = parseRoute()
      setGameId(r.gameId)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Chess"
          rules={<RulesPanel />}
          actions={
            <>
              {gameId && (
                <button
                  aria-label="Back to lobby"
                  className="flex items-center gap-1 rounded-[0.5rem] px-2.5 py-1.5 text-[0.65rem] font-bold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--glass-hover)] transition"
                  onClick={goToLobby}
                >
                  <span className="text-xs">&#8249;</span> Lobby
                </button>
              )}
              <GameAuth />
            </>
          }
        />
      }
    >
      <div className="relative w-full h-full">
        <MultiplayerTab
          gameId={gameId}
          onLoadGame={loadGame}
          flipped={flipped}
          onFlip={() => setFlipped(f => !f)}
        />
      </div>
    </GameShell>
  )
}
