import { useEffect } from 'react'
import { useAuth } from '@progamestore/games'
import { useLobby } from '../hooks/useLobby.ts'
import { useMultiGame } from '../hooks/useMultiGame.ts'
import { useGameRoom } from '../hooks/useGameRoom.ts'
import { ActiveGamesStrip } from './ActiveGamesStrip.tsx'
import { ChallengeNotification } from './ChallengeNotification.tsx'
import { LobbyView } from './LobbyView.tsx'
import { GameView } from './GameView.tsx'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

interface MultiplayerTabProps {
  gameId: string | null
  onLoadGame: (id: string) => void
  flipped: boolean
  onFlip: () => void
}

export function MultiplayerTab({ gameId, onLoadGame, flipped, onFlip }: MultiplayerTabProps) {
  const { user } = useAuth()
  const lobby = useLobby()
  const multiGame = useMultiGame()
  const game = useGameRoom(gameId, lobby.reportResult)

  useEffect(() => {
    return lobby.onChallengeAccepted((roomId) => {
      onLoadGame(roomId)
      multiGame.addGame({ roomId, fen: START_FEN, yourColor: 'w', opponentName: '', opponentAvatar: '', isYourTurn: true, gameOver: false })
    })
  }, [lobby.onChallengeAccepted, onLoadGame, multiGame.addGame])

  const updateGame = multiGame.updateGame
  useEffect(() => {
    if (!gameId) return
    const opColor = game.yourColor === 'w' ? 'b' : 'w'
    const opponent = game.players[opColor]
    updateGame(gameId, {
      fen: game.fen,
      yourColor: game.yourColor === 'w' || game.yourColor === 'b' ? game.yourColor : 'w',
      opponentName: opponent?.name ?? '',
      opponentAvatar: opponent?.avatar ?? '',
      isYourTurn: game.isYourTurn,
      gameOver: !!game.gameOver,
    })
  }, [game.fen, game.yourColor, game.gameOver, game.players, gameId, game.isYourTurn, updateGame])

  const handleNewGame = async () => {
    const id = await game.handleNewGame()
    onLoadGame(id)
    multiGame.addGame({ roomId: id, fen: START_FEN, yourColor: 'w', opponentName: '', opponentAvatar: '', isYourTurn: true, gameOver: false })
  }

  if (!gameId) {
    return (
      <div className="flex flex-col gap-3 h-full overflow-hidden">
        {user && multiGame.games.length > 0 && (
          <div className="shrink-0 px-1 pt-1">
            <ActiveGamesStrip games={multiGame.games} activeGameId={multiGame.activeGameId} onSwitch={(id) => { multiGame.switchTo(id); onLoadGame(id) }} onRemove={multiGame.removeGame} />
          </div>
        )}
        {user && lobby.incomingChallenges.length > 0 && (
          <div className="shrink-0 px-1">
            <ChallengeNotification challenges={lobby.incomingChallenges} onAccept={lobby.acceptChallenge} onDecline={lobby.declineChallenge} />
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <LobbyView onlineUsers={lobby.onlineUsers} history={lobby.history} connected={lobby.connected} onChallenge={lobby.challenge} onCreateGame={handleNewGame} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 h-full overflow-hidden">
      {multiGame.games.length > 0 && (
        <div className="shrink-0 px-1 mb-1">
          <ActiveGamesStrip games={multiGame.games} activeGameId={gameId} onSwitch={(id) => { multiGame.switchTo(id); onLoadGame(id) }} onRemove={multiGame.removeGame} />
        </div>
      )}
      {lobby.incomingChallenges.length > 0 && (
        <div className="shrink-0 px-1">
          <ChallengeNotification challenges={lobby.incomingChallenges} onAccept={lobby.acceptChallenge} onDecline={lobby.declineChallenge} />
        </div>
      )}
      <GameView game={game} flipped={flipped} onFlip={onFlip} onNewGame={handleNewGame} />
    </div>
  )
}
