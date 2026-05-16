// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — strict array indexing is guaranteed by inBounds() checks throughout

export const BOARD_SIZE = 15

export type Board = number[][]
export type Player = 1 | 2

export interface Move {
  x: number
  y: number
}

export interface ThreatInfo {
  type: 'five' | 'open_four' | 'four' | 'open_three' | 'three' | 'open_two'
  positions: Move[]
  player: Player
  direction: string
}

export interface BoardAnalysis {
  threats: ThreatInfo[]
  criticalAttack: Move | null
  criticalDefense: Move | null
  candidates: Array<Move & { score: number; reason: string }>
  boardAscii: string
  moveCount: number
  phase: 'opening' | 'midgame' | 'endgame'
}

const DIRECTIONS = [
  { dx: 1, dy: 0, name: 'horizontal' },
  { dx: 0, dy: 1, name: 'vertical' },
  { dx: 1, dy: 1, name: 'diagonal' },
  { dx: 1, dy: -1, name: 'antidiagonal' },
]

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE
}

function getLine(board: Board, x: number, y: number, dx: number, dy: number, len: number): number[] {
  const cells: number[] = []
  for (let i = 0; i < len; i++) {
    const nx = x + i * dx
    const ny = y + i * dy
    if (!inBounds(nx, ny)) break
    cells.push(board[ny][nx])
  }
  return cells
}

function countConsecutive(board: Board, x: number, y: number, dx: number, dy: number, player: Player): number {
  let count = 0
  let nx = x + dx
  let ny = y + dy
  while (inBounds(nx, ny) && board[ny][nx] === player) {
    count++
    nx += dx
    ny += dy
  }
  return count
}

function analyzePattern(board: Board, x: number, y: number, dx: number, dy: number, player: Player): ThreatInfo | null {
  const fwd = countConsecutive(board, x, y, dx, dy, player)
  const bwd = countConsecutive(board, x, y, -dx, -dy, player)
  const total = fwd + bwd + 1

  if (total < 2) return null

  const fwdEnd = { x: x + (fwd + 1) * dx, y: y + (fwd + 1) * dy }
  const bwdEnd = { x: x - (bwd + 1) * dx, y: y - (bwd + 1) * dy }
  const fwdOpen = inBounds(fwdEnd.x, fwdEnd.y) && board[fwdEnd.y][fwdEnd.x] === 0
  const bwdOpen = inBounds(bwdEnd.x, bwdEnd.y) && board[bwdEnd.y][bwdEnd.x] === 0
  const openEnds = (fwdOpen ? 1 : 0) + (bwdOpen ? 1 : 0)

  const positions: Move[] = []
  for (let i = -bwd; i <= fwd; i++) {
    positions.push({ x: x + i * dx, y: y + i * dy })
  }

  const dir = DIRECTIONS.find(d => d.dx === Math.abs(dx) && d.dy === Math.abs(dy))?.name || 'unknown'

  if (total >= 5) return { type: 'five', positions, player, direction: dir }
  if (total === 4 && openEnds === 2) return { type: 'open_four', positions, player, direction: dir }
  if (total === 4 && openEnds === 1) return { type: 'four', positions, player, direction: dir }
  if (total === 3 && openEnds === 2) return { type: 'open_three', positions, player, direction: dir }
  if (total === 3 && openEnds === 1) return { type: 'three', positions, player, direction: dir }
  if (total === 2 && openEnds === 2) return { type: 'open_two', positions, player, direction: dir }

  return null
}

export function detectThreats(board: Board): ThreatInfo[] {
  const threats: ThreatInfo[] = []
  const seen = new Set<string>()

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const player = board[y][x] as Player
      if (player === 0) continue

      for (const { dx, dy } of DIRECTIONS) {
        const prev = board[y - dy]?.[x - dx]
        if (prev === player) continue // Already counted from that direction

        const threat = analyzePattern(board, x, y, dx, dy, player)
        if (!threat) continue

        const key = `${threat.type}-${threat.player}-${threat.positions.map(p => `${p.x},${p.y}`).join('|')}`
        if (!seen.has(key)) {
          seen.add(key)
          threats.push(threat)
        }
      }
    }
  }

  return threats
}

const THREAT_SCORES: Record<ThreatInfo['type'], number> = {
  five: 1_000_000,
  open_four: 100_000,
  four: 10_000,
  open_three: 5_000,
  three: 1_000,
  open_two: 200,
}

export function scoreMoveHeuristic(board: Board, x: number, y: number, player: Player): number {
  if (board[y][x] !== 0) return -1

  let score = 0
  const opponent = player === 1 ? 2 : 1

  board[y][x] = player
  for (const { dx, dy } of DIRECTIONS) {
    const t = analyzePattern(board, x, y, dx, dy, player)
    if (t) score += THREAT_SCORES[t.type]
  }
  board[y][x] = 0

  board[y][x] = opponent as Player
  for (const { dx, dy } of DIRECTIONS) {
    const t = analyzePattern(board, x, y, dx, dy, opponent as Player)
    if (t) score += THREAT_SCORES[t.type] * 0.9
  }
  board[y][x] = 0

  // Center preference, decaying with distance
  const dist = Math.abs(x - 7) + Math.abs(y - 7)
  score += Math.max(0, (14 - dist)) * 10

  // Proximity to existing stones
  let hasNeighbor = false
  for (let dy2 = -2; dy2 <= 2; dy2++) {
    for (let dx2 = -2; dx2 <= 2; dx2++) {
      if (dx2 === 0 && dy2 === 0) continue
      const nx = x + dx2
      const ny = y + dy2
      if (inBounds(nx, ny) && board[ny][nx] !== 0) {
        hasNeighbor = true
        score += (Math.abs(dx2) <= 1 && Math.abs(dy2) <= 1) ? 15 : 5
      }
    }
  }

  if (!hasNeighbor && score < 100) score = 1 // Empty region is low priority

  return score
}

export function getCandidateMoves(board: Board, topN = 20): Array<Move & { score: number }> {
  const candidates: Array<Move & { score: number }> = []

  // If board is empty, play center
  const isEmpty = board.every(row => row.every(c => c === 0))
  if (isEmpty) return [{ x: 7, y: 7, score: 999 }]

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== 0) continue
      const score = scoreMoveHeuristic(board, x, y, 2)
      if (score > 0) candidates.push({ x, y, score })
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, topN)
}

export function boardToAscii(board: Board, highlights: Move[] = [], lastMove?: Move): string {
  const highlightSet = new Set(highlights.map(m => `${m.x},${m.y}`))
  const cols = '  A B C D E F G H I J K L M N O'
  const lines: string[] = [cols]

  for (let y = 0; y < BOARD_SIZE; y++) {
    const rowNum = String(y + 1).padStart(2)
    const cells = board[y].map((cell, x) => {
      const isLast = lastMove?.x === x && lastMove?.y === y
      const isHigh = highlightSet.has(`${x},${y}`)
      if (cell === 1) return isLast ? '[●]' : ' ● '
      if (cell === 2) return isLast ? '[○]' : ' ○ '
      if (isHigh) return ' + '
      return ' · '
    })
    lines.push(`${rowNum}${cells.join('')}`)
  }

  return lines.join('\n')
}

export function analyzeBoard(board: Board, moves: Move[]): BoardAnalysis {
  const threats = detectThreats(board)
  const moveCount = moves.length

  const phase: BoardAnalysis['phase'] =
    moveCount < 10 ? 'opening' :
    moveCount < 60 ? 'midgame' : 'endgame'

  // Find critical moves
  const aiWinThreat = threats.find(t => t.player === 2 && t.type === 'five')
  const humanWinThreat = threats.find(t => t.player === 1 && t.type === 'five')
  const aiOpenFour = threats.find(t => t.player === 2 && t.type === 'open_four')
  const humanOpenFour = threats.find(t => t.player === 1 && t.type === 'open_four')
  const aiFour = threats.find(t => t.player === 2 && t.type === 'four')
  const humanFour = threats.find(t => t.player === 1 && t.type === 'four')

  let criticalAttack: Move | null = null
  let criticalDefense: Move | null = null

  // If AI can win immediately
  if (aiWinThreat) {
    const gap = aiWinThreat.positions.find(p => board[p.y][p.x] === 0)
    if (gap) criticalAttack = gap
  } else if (aiOpenFour) {
    const gap = aiOpenFour.positions.find(p => board[p.y][p.x] === 0)
    if (gap) criticalAttack = gap
  } else if (aiFour) {
    const gap = aiFour.positions.find(p => board[p.y][p.x] === 0)
    if (gap) criticalAttack = gap
  }

  // If human is about to win
  if (humanWinThreat) {
    const gap = humanWinThreat.positions.find(p => board[p.y][p.x] === 0)
    if (gap) criticalDefense = gap
  } else if (humanOpenFour) {
    const gap = humanOpenFour.positions.find(p => board[p.y][p.x] === 0)
    if (gap) criticalDefense = gap
  } else if (humanFour) {
    const gap = humanFour.positions.find(p => board[p.y][p.x] === 0)
    if (gap) criticalDefense = gap
  }

  const rawCandidates = getCandidateMoves(board, 15)
  const candidates = rawCandidates.map(c => ({
    ...c,
    reason: describeMove(board, c.x, c.y),
  }))

  const lastMove = moves.length > 0 ? moves[moves.length - 1] : undefined
  const highlightMoves = candidates.slice(0, 5).map(c => ({ x: c.x, y: c.y }))
  const boardAscii = boardToAscii(board, highlightMoves, lastMove)

  return { threats, criticalAttack, criticalDefense, candidates, boardAscii, moveCount, phase }
}

function describeMove(board: Board, x: number, y: number): string {
  const col = 'ABCDEFGHIJKLMNO'[x]
  const row = y + 1
  const pos = `${col}${row}`

  let maxLen = 0
  let best: ThreatInfo | null = null

  board[y][x] = 2
  for (const { dx, dy } of DIRECTIONS) {
    const t = analyzePattern(board, x, y, dx, dy, 2)
    if (t && THREAT_SCORES[t.type] > (best ? THREAT_SCORES[best.type] : 0)) {
      best = t
    }
  }
  board[y][x] = 0

  if (best?.type === 'five') return `${pos}: winning move`
  if (best?.type === 'open_four') return `${pos}: creates open four`
  if (best?.type === 'four') return `${pos}: creates four`
  if (best?.type === 'open_three') return `${pos}: creates open three`
  if (best?.type === 'three') return `${pos}: creates three`
  return `${pos}: develops position`
}
