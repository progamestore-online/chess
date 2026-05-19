export type Mode = 'play' | 'puzzles' | 'multiplayer' | 'preferences'

export interface Puzzle {
  id: string
  fen: string
  // Space-separated UCI moves: first is opponent's setup move, rest is the solution
  moves: string
  rating: number
  themes: string[]
}

export type PuzzleStatus = 'playing' | 'solved' | 'failed'

export type Difficulty = 1 | 2 | 3 | 4 | 5

export type PlayerColor = 'w' | 'b'

export type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned'

export interface GameState {
  playerColor: PlayerColor
  difficulty: Difficulty
  status: GameStatus
  winner?: PlayerColor
}

export interface MoveAnalysis {
  move: string
  evaluation: number
  bestMove: string | null
  bestEval: number
  category: 'brilliant' | 'great' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
  explanation: string
}
