import { useState, useCallback, useMemo, useRef } from 'react'
import { Chess, type Square } from 'chess.js'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

// Cburnett SVG chess pieces (CC-BY-SA 3.0 — used by lichess / Wikipedia).
// Files live in /public/pieces/{w,b}{k,q,r,b,n,p}.svg
function pieceHref(color: 'w' | 'b', type: string): string {
  return `/pieces/${color}${type}.svg`
}

interface BoardProps {
  chess: Chess
  flipped: boolean
  playerColor: 'w' | 'b'
  onMove: (from: Square, to: Square, promotion?: string) => boolean
  lastMove?: { from: Square; to: Square } | null
  selectedSquare?: Square | null
  onSquareClick?: (sq: Square | null) => void
  previewFen?: string | null
  previewArrow?: { from: Square; to: Square } | null
  // Label shown in the blue banner over a preview. Defaults to "Best alternative".
  // Pass an empty string to hide the banner entirely.
  previewLabel?: string
  // Arrow drawn on the live board (not in preview mode), e.g. for a hint.
  liveArrow?: { from: Square; to: Square } | null
}

export function Board({ chess, flipped, playerColor, onMove, lastMove, selectedSquare, onSquareClick, previewFen, previewArrow, previewLabel = 'Best alternative', liveArrow }: BoardProps) {
  const [dragFrom, setDragFrom] = useState<Square | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  // When the player drops or taps a pawn onto the back rank, we hold the move
  // here until they pick a piece. null = no pending promotion.
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square
    to: Square
    color: 'w' | 'b'
  } | null>(null)

  const isPreview = !!previewFen
  const displayChess = isPreview ? new Chess(previewFen!) : chess
  const board = displayChess.board()
  const ranks = flipped ? [...RANKS].reverse() : RANKS
  const files = flipped ? [...FILES].reverse() : FILES

  const isInCheck = !isPreview && chess.isCheck()
  const kingInCheck = isInCheck ? findKing(chess, chess.turn()) : null

  // Get legal moves for selected square
  const legalTargets = useMemo(
    () => (selectedSquare
      ? chess.moves({ square: selectedSquare, verbose: true }).map((move) => move.to)
      : []),
    [chess, selectedSquare],
  )

  const handleSquareClick = useCallback((sq: Square) => {
    if (selectedSquare) {
      if (legalTargets.includes(sq)) {
        const piece = chess.get(selectedSquare)
        const isPromotion = piece?.type === 'p' && (sq[1] === '8' || sq[1] === '1')
        if (isPromotion && piece) {
          setPendingPromotion({ from: selectedSquare, to: sq, color: piece.color })
          return
        }
        onMove(selectedSquare, sq)
        onSquareClick?.(null)
        return
      }
      // Clicked same square = deselect, clicked another own piece = reselect
      if (sq === selectedSquare) {
        onSquareClick?.(null)
      } else {
        const piece = chess.get(sq)
        onSquareClick?.(piece && piece.color === playerColor ? sq : null)
      }
    } else {
      const piece = chess.get(sq)
      if (piece && piece.color === playerColor && chess.turn() === playerColor) {
        onSquareClick?.(sq)
      }
    }
  }, [chess, playerColor, selectedSquare, legalTargets, onMove, onSquareClick])

  const dragStartRef = useRef<{ sq: Square; x: number; y: number; started: boolean } | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent, sq: Square) => {
    const piece = chess.get(sq)
    if (!piece || piece.color !== playerColor || chess.turn() !== playerColor) return

    dragStartRef.current = { sq, x: e.clientX, y: e.clientY, started: false }
  }, [chess, playerColor])

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    const start = dragStartRef.current
    if (!start) return

    // Only begin visual drag after moving 8px (distinguishes tap from drag)
    if (!start.started) {
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (dx * dx + dy * dy < 64) return
      start.started = true
      const piece = chess.get(start.sq)
      if (piece) {
        setDragFrom(start.sq)
        onSquareClick?.(start.sq)
      }
    }

    if (!dragFrom) return
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragPos({ x: (e.clientX - rect.left) * 800 / rect.width, y: (e.clientY - rect.top) * 800 / rect.height })
  }, [chess, dragFrom, onSquareClick])

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    const start = dragStartRef.current
    dragStartRef.current = null

    if (!dragFrom || !start?.started) {
      // Not a drag — it was a tap, handled by onClick
      setDragFrom(null)
      setDragPos(null)
      return
    }

    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const sqSize = rect.width / 8
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const col = Math.floor(x / sqSize)
    const row = Math.floor(y / sqSize)

    if (col >= 0 && col < 8 && row >= 0 && row < 8) {
      const file = files[col]
      const rank = ranks[row]
      const to = `${file}${rank}` as Square

      if (to !== dragFrom) {
        const piece = chess.get(dragFrom)
        const isPromotion = piece?.type === 'p' && (to[1] === '8' || to[1] === '1')
        if (isPromotion && piece) {
          setPendingPromotion({ from: dragFrom, to, color: piece.color })
        } else {
          onMove(dragFrom, to)
          onSquareClick?.(null)
        }
      }
    }

    setDragFrom(null)
    setDragPos(null)
  }, [dragFrom, chess, files, ranks, onMove, onSquareClick])

  const confirmPromotion = useCallback((piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return
    onMove(pendingPromotion.from, pendingPromotion.to, piece)
    setPendingPromotion(null)
    onSquareClick?.(null)
  }, [pendingPromotion, onMove, onSquareClick])

  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null)
    onSquareClick?.(null)
  }, [onSquareClick])

  return (
    <div className="chess-board-wrap relative aspect-square select-none w-full max-h-[calc(100svh-11rem)] landscape:max-h-[calc(100svh-8.5rem)] lg:max-h-none">
      <svg
        className="chess-board w-full h-full rounded-[0.5rem] shadow-[var(--shadow-soft)] overflow-hidden"
        viewBox="0 0 800 800"
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerLeave={handleDragEnd}
      >
        {/* Board squares */}
        {ranks.map((rank, row) =>
          files.map((file, col) => {
            const sq = `${file}${rank}` as Square
            const isLight = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0
            const isSelected = selectedSquare === sq
            const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq)
            const isCheckSquare = kingInCheck === sq
            const isLegalTarget = legalTargets.includes(sq)
            const piece = board[RANKS.indexOf(rank)][FILES.indexOf(file)]

            return (
              <g key={sq}>
                {/* Square background */}
                <rect
                  x={col * 100}
                  y={row * 100}
                  width={100}
                  height={100}
                  fill={isLight ? 'var(--board-light)' : 'var(--board-dark)'}
                />

                {/* Square overlay: last-move, selected piece, or king-in-check */}
                {(isLastMove || isSelected || isCheckSquare) && (
                  <rect
                    x={col * 100}
                    y={row * 100}
                    width={100}
                    height={100}
                    fill={isCheckSquare ? 'var(--board-check)' : 'var(--board-highlight)'}
                  />
                )}

                {/* Legal move hint */}
                {isLegalTarget && !piece && (
                  <circle
                    cx={col * 100 + 50}
                    cy={row * 100 + 50}
                    r={16}
                    fill="var(--board-move-hint)"
                  />
                )}
                {isLegalTarget && piece && (
                  <circle
                    cx={col * 100 + 50}
                    cy={row * 100 + 50}
                    r={46}
                    fill="none"
                    stroke="var(--board-move-hint)"
                    strokeWidth={6}
                  />
                )}

                {/* Click target */}
                <rect
                  x={col * 100}
                  y={row * 100}
                  width={100}
                  height={100}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSquareClick(sq)}
                  onPointerDown={(e) => handlePointerDown(e, sq)}
                />

                {/* Piece */}
                {piece && !(dragFrom === sq && dragPos) && (
                  <image
                    href={pieceHref(piece.color, piece.type)}
                    x={col * 100 + 6}
                    y={row * 100 + 6}
                    width={88}
                    height={88}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  />
                )}
              </g>
            )
          })
        )}

        {/* File labels */}
        {files.map((file, col) => (
          <text
            key={`file-${file}`}
            x={col * 100 + 92}
            y={776}
            fontSize={22}
            fontWeight={700}
            textAnchor="end"
            fill={(col + 7) % 2 === 0 ? 'var(--board-dark)' : 'var(--board-light)'}
            style={{ pointerEvents: 'none', opacity: 0.6 }}
          >
            {file}
          </text>
        ))}

        {/* Rank labels */}
        {ranks.map((rank, row) => (
          <text
            key={`rank-${rank}`}
            x={8}
            y={row * 100 + 24}
            fontSize={22}
            fontWeight={700}
            fill={row % 2 === 0 ? 'var(--board-dark)' : 'var(--board-light)'}
            style={{ pointerEvents: 'none', opacity: 0.6 }}
          >
            {rank}
          </text>
        ))}

        {/* Preview arrow for best move */}
        {isPreview && previewArrow && (() => {
          const fromCol = files.indexOf(previewArrow.from[0])
          const fromRow = ranks.indexOf(previewArrow.from[1])
          const toCol = files.indexOf(previewArrow.to[0])
          const toRow = ranks.indexOf(previewArrow.to[1])
          if (fromCol < 0 || fromRow < 0 || toCol < 0 || toRow < 0) return null
          const x1 = fromCol * 100 + 50
          const y1 = fromRow * 100 + 50
          const x2 = toCol * 100 + 50
          const y2 = toRow * 100 + 50
          return (
            <g style={{ pointerEvents: 'none' }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="rgba(85, 160, 255, 0.85)" />
                </marker>
              </defs>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(85, 160, 255, 0.7)" strokeWidth={14} strokeLinecap="round"
                markerEnd="url(#arrowhead)"
              />
            </g>
          )
        })()}

        {/* Preview overlay label */}
        {isPreview && previewLabel && (
          <rect x={0} y={0} width={800} height={32} fill="rgba(85, 160, 255, 0.85)" rx={0} style={{ pointerEvents: 'none' }} />
        )}
        {isPreview && previewLabel && (
          <text x={400} y={22} textAnchor="middle" fontSize={14} fontWeight={700} fill="white" style={{ pointerEvents: 'none' }}>
            {previewLabel}
          </text>
        )}

        {/* Live arrow (e.g. hint) — only when not previewing */}
        {!isPreview && liveArrow && (() => {
          const fromCol = files.indexOf(liveArrow.from[0])
          const fromRow = ranks.indexOf(liveArrow.from[1])
          const toCol = files.indexOf(liveArrow.to[0])
          const toRow = ranks.indexOf(liveArrow.to[1])
          if (fromCol < 0 || fromRow < 0 || toCol < 0 || toRow < 0) return null
          const x1 = fromCol * 100 + 50
          const y1 = fromRow * 100 + 50
          const x2 = toCol * 100 + 50
          const y2 = toRow * 100 + 50
          return (
            <g style={{ pointerEvents: 'none' }}>
              <defs>
                <marker id="hint-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255, 200, 80, 0.9)" />
                </marker>
              </defs>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(255, 200, 80, 0.75)" strokeWidth={14} strokeLinecap="round"
                markerEnd="url(#hint-arrowhead)"
              />
            </g>
          )
        })()}

        {/* Promotion picker overlay */}
        {!isPreview && pendingPromotion && (() => {
          const toCol = files.indexOf(pendingPromotion.to[0])
          const toRow = ranks.indexOf(pendingPromotion.to[1])
          if (toCol < 0 || toRow < 0) return null
          // Stack toward the center: if landing on the top half, grow downward;
          // bottom half, grow upward. The destination square always shows Queen.
          const direction = toRow < 4 ? 1 : -1
          const pieces: Array<'q' | 'r' | 'b' | 'n'> = ['q', 'r', 'b', 'n']
          return (
            <g>
              {/* Dim the rest of the board with a click-to-cancel scrim */}
              <rect
                x={0}
                y={0}
                width={800}
                height={800}
                fill="rgba(0,0,0,0.55)"
                style={{ cursor: 'pointer' }}
                onClick={cancelPromotion}
              />
              {pieces.map((p, i) => {
                const row = toRow + direction * i
                if (row < 0 || row > 7) return null
                const cx = toCol * 100
                const cy = row * 100
                return (
                  <g key={p} style={{ cursor: 'pointer' }} onClick={() => confirmPromotion(p)}>
                    <rect
                      x={cx}
                      y={cy}
                      width={100}
                      height={100}
                      fill="var(--glass)"
                      stroke="var(--accent)"
                      strokeWidth={i === 0 ? 4 : 2}
                    />
                    <image
                      href={pieceHref(pendingPromotion.color, p)}
                      x={cx + 6}
                      y={cy + 6}
                      width={88}
                      height={88}
                      style={{ pointerEvents: 'none' }}
                    />
                  </g>
                )
              })}
            </g>
          )
        })()}

        {/* Dragged piece */}
        {!isPreview && dragPos && dragFrom && (() => {
          const dp = chess.get(dragFrom)
          if (!dp) return null
          return (
            <image
              href={pieceHref(dp.color, dp.type)}
              x={dragPos.x - 50}
              y={dragPos.y - 50}
              width={100}
              height={100}
              style={{ pointerEvents: 'none', opacity: 0.9 }}
            />
          )
        })()}
      </svg>
    </div>
  )
}

function findKing(chess: Chess, color: 'w' | 'b'): Square | null {
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.type === 'k' && p.color === color) {
        return `${FILES[c]}${RANKS[r]}` as Square
      }
    }
  }
  return null
}
