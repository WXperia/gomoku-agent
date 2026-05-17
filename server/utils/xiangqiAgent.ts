import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLLM, type AIConfig, type UserLanguage } from './gomokuAgent'

export type XiangqiPiece = 'rK' | 'rA' | 'rB' | 'rN' | 'rR' | 'rC' | 'rP' | 'bK' | 'bA' | 'bB' | 'bN' | 'bR' | 'bC' | 'bP'

export interface XiangqiMove {
  fromX: number
  fromY: number
  toX: number
  toY: number
  piece?: string
  captured?: string | null
}

export interface XiangqiAgentOutput {
  move: XiangqiMove
  reasoning: string
  taunt: string
  confidence: 'high' | 'medium' | 'low'
  thinkingSteps: string[]
}

const FILES = 'ABCDEFGHI'

const PIECE_LABELS: Record<string, string> = {
  rK: 'Red General', rA: 'Red Advisor', rB: 'Red Elephant', rN: 'Red Horse', rR: 'Red Chariot', rC: 'Red Cannon', rP: 'Red Soldier',
  bK: 'Black General', bA: 'Black Advisor', bB: 'Black Elephant', bN: 'Black Horse', bR: 'Black Chariot', bC: 'Black Cannon', bP: 'Black Soldier',
}

const SYSTEM_PROMPT = `You are a strong Chinese Xiangqi (Chinese chess) player. You play Black. The human plays Red.

Choose exactly one move from the numbered legal move list. Do not invent coordinates. Do not output anything except JSON.

Strategic priorities:
1. If you can win or capture the Red general safely, do it.
2. If your general is in danger, choose a move that resolves it.
3. Prefer active development, central control, cannon/rook pressure, and material gain.
4. Avoid pointless early material grabs if they lose initiative or expose your general.

Respond with ONLY JSON:
{"moveIndex":1,"reasoning":"short strategic reason","confidence":"high|medium|low","taunt":"short optional taunt"}`

function languageInstruction(language: UserLanguage) {
  return language === 'zh'
    ? 'The user interface language is Simplified Chinese. The "taunt" field MUST be Simplified Chinese.'
    : 'The user interface language is English. The "taunt" field MUST be English.'
}

function hasCjk(text: string) {
  return /[\u3400-\u9fff]/.test(text)
}

function fallbackTaunt(language: UserLanguage) {
  return language === 'zh'
    ? '这步棋很讲道理，难受的部分留给你。'
    : 'That move is clean. The uncomfortable part is yours.'
}

function normalizeTaunt(taunt: string, language: UserLanguage) {
  const trimmed = taunt.trim()
  if (!trimmed) return fallbackTaunt(language)
  if (language === 'zh') return hasCjk(trimmed) ? trimmed : fallbackTaunt(language)
  return hasCjk(trimmed) ? fallbackTaunt(language) : trimmed
}

function coord(x: number, y: number) {
  return `${FILES[x]}${y + 1}`
}

function boardToText(board: (XiangqiPiece | null)[][]) {
  return board.map((row, y) => {
    const cells = row.map((piece, x) => piece ? `${coord(x, y)}=${piece}` : null).filter(Boolean)
    return cells.length ? cells.join(' ') : `row ${y + 1}: empty`
  }).join('\n')
}

function legalMovesToText(board: (XiangqiPiece | null)[][], legalMoves: XiangqiMove[]) {
  return legalMoves.map((move, index) => {
    const piece = board[move.fromY]?.[move.fromX]
    const target = board[move.toY]?.[move.toX]
    const capture = target ? ` captures ${PIECE_LABELS[target] ?? target}` : ''
    return `${index + 1}. ${PIECE_LABELS[piece ?? ''] ?? piece} ${coord(move.fromX, move.fromY)} -> ${coord(move.toX, move.toY)}${capture} JSON={"moveIndex":${index + 1}}`
  }).join('\n')
}

function extractJson(raw: string) {
  const jsonMatch = raw.match(/\{[\s\S]*?\}/)
  if (!jsonMatch) throw new Error(`No JSON found in response: ${raw.slice(0, 120)}`)
  return JSON.parse(jsonMatch[0])
}

function parseResponse(raw: string, legalMoves: XiangqiMove[], language: UserLanguage) {
  const parsed = extractJson(raw)
  const moveIndex = Number(parsed.moveIndex)
  let legal: XiangqiMove | undefined

  if (Number.isInteger(moveIndex) && moveIndex >= 1 && moveIndex <= legalMoves.length) {
    legal = legalMoves[moveIndex - 1]
  }

  if (!legal) {
    const fromX = Number(parsed.fromX)
    const fromY = Number(parsed.fromY)
    const toX = Number(parsed.toX)
    const toY = Number(parsed.toY)
    legal = legalMoves.find(m => m.fromX === fromX && m.fromY === fromY && m.toX === toX && m.toY === toY)
  }

  if (!legal) throw new Error(`Model chose an illegal move index: ${parsed.moveIndex}`)

  const confidence = (['high', 'medium', 'low'] as const).includes(parsed.confidence)
    ? parsed.confidence as 'high' | 'medium' | 'low'
    : 'medium'

  return {
    move: legal,
    reasoning: String(parsed.reasoning ?? ''),
    taunt: normalizeTaunt(String(parsed.taunt ?? ''), language),
    confidence,
  }
}

function fallbackMove(board: (XiangqiPiece | null)[][], legalMoves: XiangqiMove[], language: UserLanguage): XiangqiAgentOutput {
  const scored = legalMoves.map((move, index) => {
    const piece = board[move.fromY]?.[move.fromX]
    const target = board[move.toY]?.[move.toX]
    let score = 0
    if (target === 'rK') score += 10000
    if (target) score += 100
    if (piece === 'bR') score += 8
    if (piece === 'bC') score += 6
    score += Math.max(0, 4 - Math.abs(move.toX - 4))
    return { move, index, score }
  }).sort((a, b) => b.score - a.score)

  const picked = scored[0] ?? { move: legalMoves[0]!, index: 0, score: 0 }
  return {
    move: picked.move,
    reasoning: `Rules-engine fallback selected legal move #${picked.index + 1}.`,
    taunt: fallbackTaunt(language),
    confidence: 'low',
    thinkingSteps: [`[Fallback] Model did not return a valid moveIndex; using legal move #${picked.index + 1}.`],
  }
}

export async function runXiangqiAgent(input: {
  board: (XiangqiPiece | null)[][]
  legalMoves: XiangqiMove[]
  moves: Array<{ fromX?: number; fromY?: number; x: number; y: number; player: 1 | 2; piece?: string; captured?: string | null }>
  config: AIConfig
  language?: UserLanguage
}): Promise<XiangqiAgentOutput> {
  const llm = createLLM(input.config)
  const language = input.language ?? 'zh'
  const thinkingSteps = [`[Rules] Received ${input.legalMoves.length} legal moves from validator.`]

  const lastMoves = input.moves.slice(-8).map(m => {
    const from = m.fromX != null && m.fromY != null ? `${coord(m.fromX, m.fromY)} -> ` : ''
    return `${m.player === 1 ? 'Red' : 'Black'} ${m.piece ?? ''} ${from}${coord(m.x, m.y)}${m.captured ? ` captured ${m.captured}` : ''}`
  }).join('\n')

  const prompt = `Current board:
${boardToText(input.board)}

Recent moves:
${lastMoves || '(none)'}

Language rule:
${languageInstruction(language)}

Legal Black moves:
${legalMovesToText(input.board, input.legalMoves)}

Pick the best legal Black move by moveIndex.`

  let lastError = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await llm.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(lastError ? `${prompt}\n\nPrevious response error: ${lastError}. Choose only a valid moveIndex from the list.` : prompt),
    ])
    const raw = typeof response.content === 'string'
      ? response.content
      : (response.content as any[])[0]?.text ?? ''

    try {
      const parsed = parseResponse(raw, input.legalMoves, language)
      thinkingSteps.push(`[Model attempt ${attempt}] ${coord(parsed.move.fromX, parsed.move.fromY)} -> ${coord(parsed.move.toX, parsed.move.toY)}: ${parsed.reasoning.slice(0, 100)}`)
      return { ...parsed, thinkingSteps }
    } catch (err: any) {
      lastError = err?.message || String(err)
      thinkingSteps.push(`[Model attempt ${attempt}] Invalid: ${lastError.slice(0, 140)}`)
    }
  }

  const fallback = fallbackMove(input.board, input.legalMoves, language)
  return {
    ...fallback,
    thinkingSteps: [...thinkingSteps, ...fallback.thinkingSteps],
  }
}

export async function streamXiangqiAgent(
  input: Parameters<typeof runXiangqiAgent>[0],
  emit: (event: { type: 'step'; text: string } | { type: 'done'; move: XiangqiMove; reasoning: string; taunt: string; confidence: 'high' | 'medium' | 'low'; thinkingSteps: string[] } | { type: 'error'; message: string }) => void,
) {
  emit({ type: 'step', text: `[Rules] Received ${input.legalMoves.length} legal moves from validator.` })
  const result = await runXiangqiAgent(input)
  for (const step of result.thinkingSteps.slice(1)) emit({ type: 'step', text: step })
  emit({ type: 'done', ...result })
}
