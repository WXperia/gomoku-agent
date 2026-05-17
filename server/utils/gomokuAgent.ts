import { StateGraph, Annotation } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import Anthropic from '@anthropic-ai/sdk'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { z } from 'zod'
import {
  analyzeBoard,
  getCandidateMoves,
  detectThreats,
  boardToAscii,
  scoreMoveHeuristic,
  BOARD_SIZE,
  type Board,
  type Move,
  type BoardAnalysis,
} from './gomokuBoard'

export type ModelProvider = 'openai' | 'anthropic' | 'deepseek' | 'minimax'

export interface AIConfig {
  provider: ModelProvider
  modelName?: string
  apiKey: string
  baseUrl?: string
  temperature?: number
}

export interface AgentInput {
  board: Board
  moves: Move[]
  config: AIConfig
}

export interface AgentOutput {
  move: Move
  reasoning: string
  taunt: string
  confidence: 'high' | 'medium' | 'low'
  thinkingSteps: string[]
}

// ── LangGraph state ──────────────────────────────────────────────────────────

const AgentState = Annotation.Root({
  board: Annotation<Board>(),
  moves: Annotation<Move[]>(),
  analysis: Annotation<BoardAnalysis | null>({ default: () => null, reducer: (_, v) => v }),
  modelMove: Annotation<Move | null>({ default: () => null, reducer: (_, v) => v }),
  forcedMove: Annotation<Move | null>({ default: () => null, reducer: (_, v) => v }),
  finalMove: Annotation<Move | null>({ default: () => null, reducer: (_, v) => v }),
  reasoning: Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  taunt: Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  confidence: Annotation<'high' | 'medium' | 'low'>({ default: () => 'medium', reducer: (_, v) => v }),
  thinkingSteps: Annotation<string[]>({ default: () => [], reducer: (a, v) => [...a, ...v] }),
  llm: Annotation<ReturnType<typeof createLLM>>(),
})

type AgentStateType = typeof AgentState.State

// ── LLM factory ─────────────────────────────────────────────────────────────

export function createLLM(config: AIConfig) {
  if (config.provider === 'openai') {
    return new ChatOpenAI({
      model: config.modelName || 'gpt-4o',
      apiKey: config.apiKey,
      configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
      ...(config.temperature == null ? {} : { temperature: config.temperature }),
    })
  } else {
    return new ChatAnthropic({
      model: config.modelName || 'claude-opus-4-7',
      apiKey: config.apiKey,
      anthropicApiUrl: config.baseUrl,
      ...(config.temperature == null ? {} : { temperature: config.temperature }),
      createClient: (options: Record<string, unknown>) => {
        return new Anthropic({
          ...options,
          apiKey: config.apiKey,
          baseURL: config.baseUrl,
          authToken: null,
        })
      },
    })
  }
}

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional Gomoku (五子棋) player competing at master level. You play as ○ (White, Player 2). Your opponent plays as ● (Black, Player 1).

## Board notation
- The board is 15×15, columns A–O (x=0–14, left→right), rows 1–15 (y=0–14, top→bottom)
- Empty: ·  Black: ●  White: ○  Last move: [●] or [○]
- Coordinates: column letter + row number, e.g. H8 = center (x=7, y=7)

## Rules
- First to connect exactly 5 in a row (horizontal, vertical, or diagonal) wins
- Standard gomoku: overlines (6+) also count as a win

## Priority order — follow strictly
1. **WIN**: If you can complete 5-in-a-row right now, do it immediately
2. **BLOCK WIN**: If opponent completes 5-in-a-row on their next move, block it
3. **CREATE double-threat**: Build a position with two simultaneous winning threats (opponent can only block one)
4. **BLOCK double-threat**: Prevent opponent from building two simultaneous threats
5. **ATTACK**: Extend your longest chain, prefer open-ended formations
6. **DEVELOP**: Control center, build flexible multi-direction formations

## Critical patterns
- **Live Four** (.○○○○.): Wins next move unconditionally — opponent cannot block both ends
- **Dead Four** (×○○○○. or .○○○○×): Must respond, opponent can block one end
- **Live Three** (.○○○.): Threatens to become Live Four on next move
- **Double Three** (two Live Threes): Nearly unblockable — very powerful
- **Broken Three** (○○·○ or ○·○○): Hidden threat often missed

## Personality & trash talk
You have a cocky, trash-talking personality. After deciding your move, add a short "taunt" — a psychological jab at the opponent. Keep it witty, smug, and in the same language the board prompt is written in (if the prompt context is Chinese, taunt in Chinese; otherwise English). Vary your taunts: mock their last move, express fake sympathy, predict their doom, or pretend to be bored. Examples:
- "Is that really your plan? I've seen better moves from beginners."
- "Interesting. Wrong, but interesting."
- "I almost felt threatened there. Almost."
- "哦？这就是你的策略？有点可爱。"
- "你每走一步，我就赢近一步，感觉到了吗？"
- "说实话，我都不忍心了……算了，还是赢吧。"

## Output format
You MUST respond with ONLY a JSON object, no other text:
{"x": <column 0-14>, "y": <row 0-14>, "reasoning": "<concise strategic explanation>", "confidence": "high"|"medium"|"low", "taunt": "<witty trash talk to the opponent>"}

Example: {"x": 7, "y": 7, "reasoning": "Center control in the opening", "confidence": "high", "taunt": "Starting from the center — the only logical move. Did you expect anything less?"}`

// ── Node 1: Pre-computation (forced moves, board analysis) ────────────────────

async function precomputeNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const analysis = analyzeBoard(state.board, state.moves)
  const topCandidate = analysis.candidates[0]

  // Win in 1 — no need to ask the model
  if (analysis.criticalAttack) {
    return {
      analysis,
      forcedMove: analysis.criticalAttack,
      thinkingSteps: [`[Force] Winning move: (${analysis.criticalAttack.x},${analysis.criticalAttack.y})`],
    }
  }

  // Must-block — no need to ask the model
  if (analysis.criticalDefense) {
    return {
      analysis,
      forcedMove: analysis.criticalDefense,
      thinkingSteps: [`[Force] Blocking opponent win: (${analysis.criticalDefense.x},${analysis.criticalDefense.y})`],
    }
  }

  if (topCandidate && ['forcing_attack', 'blocking_threat', 'broken_or_open_four'].includes(topCandidate.category || '')) {
    return {
      analysis,
      forcedMove: { x: topCandidate.x, y: topCandidate.y },
      reasoning: topCandidate.reason,
      confidence: 'high',
      thinkingSteps: [`[Tactic] ${topCandidate.reason} (score=${Math.round(topCandidate.score)})`],
    }
  }

  return {
    analysis,
    thinkingSteps: [`[Analyze] Phase=${analysis.phase}, threats=${analysis.threats.length}, candidates=${analysis.candidates.length}`],
  }
}

// ── Node 2: Let the model freely choose its move (up to 2 attempts) ──────────

function buildPrompt(analysis: BoardAnalysis, moves: Move[], board: Board, prevError?: string): string {
  const lastMove = moves.at(-1)
  const lastMoveStr = lastMove
    ? `Last Black move: ${'ABCDEFGHIJKLMNO'[lastMove.x]}${lastMove.y + 1} (x=${lastMove.x}, y=${lastMove.y})`
    : 'Opening — no moves yet'

  const threatLines: string[] = []
  for (const t of analysis.threats.slice(0, 8)) {
    const pts = t.positions.map(p => `${'ABCDEFGHIJKLMNO'[p.x]}${p.y + 1}(x=${p.x},y=${p.y})`).join(' → ')
    threatLines.push(`  ${t.player === 1 ? '● Black' : '○ White'} ${t.type.replace('_', ' ')}: ${pts}`)
  }

  // List explicitly occupied cells so model doesn't repeat them
  const occupiedList: string[] = []
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y]?.[x] !== 0) {
        occupiedList.push(`${'ABCDEFGHIJKLMNO'[x]}${y + 1}(x=${x},y=${y})`)
      }
    }
  }

  const errorNote = prevError
    ? `\n⚠️ Your previous move was INVALID: ${prevError}\nYou MUST choose a different empty cell.\n`
    : ''

  return `${analysis.boardAscii}

IMPORTANT — coordinate system:
  x = column index 0–14 (A=0, B=1, ..., H=7, ..., O=14) — LEFT to RIGHT
  y = row index 0–14 (row 1 = y=0, row 8 = y=7, row 15 = y=14) — TOP to BOTTOM
  Example: center H8 = {"x":7,"y":7}

${lastMoveStr}
Moves played: ${analysis.moveCount} | Phase: ${analysis.phase}
${errorNote}
Active threats:
${threatLines.length ? threatLines.join('\n') : '  (none detected)'}

Occupied cells (DO NOT play here): ${occupiedList.slice(0, 30).join(', ')}${occupiedList.length > 30 ? ` ... and ${occupiedList.length - 30} more` : ''}

It is your turn as ○ (White). Study the board, identify the best move, and respond with ONLY the JSON.`
}

function parseModelResponse(raw: string, board: Board): { x: number; y: number; reasoning: string; taunt: string; confidence: 'high' | 'medium' | 'low' } {
  const jsonMatch = raw.match(/\{[\s\S]*?\}/)
  if (!jsonMatch) throw new Error(`No JSON found in: "${raw.slice(0, 80)}"`)

  const parsed = JSON.parse(jsonMatch[0])
  const x = Number(parsed.x)
  const y = Number(parsed.y)

  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
    throw new Error(`Out-of-bounds: x=${x}, y=${y} (must be 0–14)`)
  }
  if (board[y]?.[x] !== 0) {
    const col = 'ABCDEFGHIJKLMNO'[x]
    throw new Error(`${col}${y + 1} (x=${x},y=${y}) is already occupied — choose an EMPTY cell`)
  }

  const confidence = (['high', 'medium', 'low'] as const).includes(parsed.confidence)
    ? parsed.confidence as 'high' | 'medium' | 'low'
    : 'medium'

  return { x, y, reasoning: String(parsed.reasoning ?? ''), taunt: String(parsed.taunt ?? ''), confidence }
}

async function modelDecideNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { analysis, llm, board, moves } = state
  if (!analysis) return {}

  const steps: string[] = []
  let lastError: string | undefined

  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt = buildPrompt(analysis, moves, board, lastError)

    try {
      const response = await llm.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(prompt),
      ])

      const raw = typeof response.content === 'string'
        ? response.content
        : (response.content as any[])[0]?.text ?? ''

      const { x, y, reasoning, taunt, confidence } = parseModelResponse(raw, board)
      const allowed = analysis.candidates.slice(0, 10).some(c => c.x === x && c.y === y)
      if (!allowed && analysis.candidates.length) {
        const best = analysis.candidates[0]!
        steps.push(`[Model attempt ${attempt}] Overridden: chose non-candidate (${x},${y}); using (${best.x},${best.y})`)
        return {
          modelMove: { x: best.x, y: best.y },
          reasoning: `${best.reason}. Model suggested (${x},${y}), but evaluator preferred the stronger tactical candidate.`,
          taunt,
          confidence: 'high',
          thinkingSteps: steps,
        }
      }

      steps.push(`[Model attempt ${attempt}] Chose (${x},${y}): ${reasoning.slice(0, 100)}`)
      return { modelMove: { x, y }, reasoning, taunt, confidence, thinkingSteps: steps }
    } catch (err: any) {
      lastError = err.message?.slice(0, 150) ?? String(err)
      steps.push(`[Model attempt ${attempt}] Failed: ${lastError}`)
    }
  }

  return { thinkingSteps: steps }
}

// ── Node 3: Fallback to heuristic if model failed or gave invalid move ────────

async function fallbackNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  if (state.finalMove) return {}
  if (state.modelMove) return {}  // model succeeded, nothing to do

  const candidates = getCandidateMoves(state.board, 1)
  if (candidates.length > 0) {
    const c = candidates[0]!
    return {
      finalMove: { x: c.x, y: c.y },
      reasoning: 'Heuristic fallback.',
      confidence: 'low',
      thinkingSteps: ['[Fallback] Using heuristic best move.'],
    }
  }
  return { finalMove: { x: 7, y: 7 }, reasoning: 'Emergency fallback.', confidence: 'low' }
}

// ── Node 4: Commit final move ─────────────────────────────────────────────────

async function commitNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  if (state.forcedMove) {
    return { finalMove: state.forcedMove }
  }
  if (state.modelMove) {
    return { finalMove: state.modelMove }
  }
  return {}
}

// ── Routing ──────────────────────────────────────────────────────────────────

function routeAfterPrecompute(state: AgentStateType): 'modelDecide' | 'commit' {
  return state.forcedMove ? 'commit' : 'modelDecide'
}

function routeAfterModel(state: AgentStateType): 'commit' | 'fallback' {
  return state.modelMove ? 'commit' : 'fallback'
}

// ── Build graph ──────────────────────────────────────────────────────────────

const graph = new StateGraph(AgentState)
  .addNode('precompute', precomputeNode)
  .addNode('modelDecide', modelDecideNode)
  .addNode('fallback', fallbackNode)
  .addNode('commit', commitNode)
  .addEdge('__start__', 'precompute')
  .addConditionalEdges('precompute', routeAfterPrecompute)
  .addConditionalEdges('modelDecide', routeAfterModel)
  .addEdge('fallback', 'commit')
  .addEdge('commit', '__end__')

const compiledGraph = graph.compile()

// ── Public API ───────────────────────────────────────────────────────────────

export async function runGomokuAgent(input: AgentInput): Promise<AgentOutput> {
  const llm = createLLM(input.config)

  const result = await compiledGraph.invoke({
    board: input.board,
    moves: input.moves,
    llm,
  })

  if (!result.finalMove) {
    throw new Error('Agent failed to produce a move')
  }

  return {
    move: result.finalMove,
    reasoning: result.reasoning || 'No reasoning provided.',
    taunt: result.taunt || '',
    confidence: result.confidence || 'low',
    thinkingSteps: result.thinkingSteps || [],
  }
}

export type StreamEvent =
  | { type: 'step'; text: string }
  | { type: 'token'; field: 'reasoning' | 'taunt'; text: string }
  | { type: 'done'; move: Move; reasoning: string; taunt: string; confidence: 'high' | 'medium' | 'low'; thinkingSteps: string[] }
  | { type: 'error'; message: string }

export async function streamGomokuAgent(
  input: AgentInput,
  emit: (event: StreamEvent) => void,
): Promise<void> {
  const board = input.board
  const moves = input.moves
  const config = input.config

  // --- precompute ---
  const analysis = analyzeBoard(board, moves)
  const thinkingSteps: string[] = []

  if (analysis.criticalAttack) {
    thinkingSteps.push(`[Force] Winning move: (${analysis.criticalAttack.x},${analysis.criticalAttack.y})`)
    emit({ type: 'step', text: thinkingSteps[0] })
    const m = analysis.criticalAttack
    const col = 'ABCDEFGHIJKLMNO'[m.x]
    emit({ type: 'done', move: m, reasoning: 'Winning move — five in a row!', taunt: "GG. Did you even see that coming?", confidence: 'high', thinkingSteps })
    return
  }

  if (analysis.criticalDefense) {
    thinkingSteps.push(`[Force] Blocking opponent win: (${analysis.criticalDefense.x},${analysis.criticalDefense.y})`)
    emit({ type: 'step', text: thinkingSteps[0] })
    const m = analysis.criticalDefense
    const col = 'ABCDEFGHIJKLMNO'[m.x]
    emit({ type: 'done', move: m, reasoning: 'Blocking your winning threat.', taunt: "Nice try. Blocked.", confidence: 'high', thinkingSteps })
    return
  }

  const topCandidate = analysis.candidates[0]
  if (topCandidate && ['forcing_attack', 'blocking_threat', 'broken_or_open_four'].includes(topCandidate.category || '')) {
    const step = `[Tactic] ${topCandidate.reason} (score=${Math.round(topCandidate.score)})`
    thinkingSteps.push(step)
    emit({ type: 'step', text: step })
    emit({
      type: 'done',
      move: { x: topCandidate.x, y: topCandidate.y },
      reasoning: topCandidate.reason,
      taunt: "That position is already doing the hard work for me.",
      confidence: 'high',
      thinkingSteps,
    })
    return
  }

  const analyzeStep = `[Analyze] Phase=${analysis.phase}, threats=${analysis.threats.length}, candidates=${analysis.candidates.length}`
  thinkingSteps.push(analyzeStep)
  emit({ type: 'step', text: analyzeStep })

  // --- model streaming ---
  const llm = createLLM(config)
  const prompt = buildPrompt(analysis, moves, board)

  let fullText = ''
  let lastError: string | undefined

  for (let attempt = 1; attempt <= 2; attempt++) {
    const attemptPrompt = buildPrompt(analysis, moves, board, lastError)
    fullText = ''

    try {
      const stream = await llm.stream([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(attemptPrompt),
      ])

      // Stream raw tokens — we'll parse JSON fields as they arrive
      let jsonStarted = false
      let fieldBuffer = ''
      let currentField: 'reasoning' | 'taunt' | null = null
      let inString = false
      let escaped = false

      for await (const chunk of stream) {
        const text = typeof chunk.content === 'string'
          ? chunk.content
          : (chunk.content as any[])[0]?.text ?? ''

        fullText += text

        // Stream reasoning and taunt token by token as we parse the JSON stream
        for (const ch of text) {
          if (!jsonStarted) {
            if (ch === '{') jsonStarted = true
            continue
          }

          if (escaped) { escaped = false; if (currentField) emit({ type: 'token', field: currentField, text: ch }); continue }
          if (ch === '\\') { escaped = true; if (currentField) emit({ type: 'token', field: currentField, text: ch }); continue }

          if (!inString) {
            fieldBuffer += ch
            // detect field name
            const rfMatch = fieldBuffer.match(/"(reasoning|taunt)"\s*:\s*"$/)
            if (rfMatch) {
              currentField = rfMatch[1] as 'reasoning' | 'taunt'
              inString = true
              fieldBuffer = ''
            }
          } else {
            if (ch === '"') {
              inString = false
              currentField = null
              fieldBuffer = ''
            } else {
              if (currentField) emit({ type: 'token', field: currentField, text: ch })
            }
          }
        }
      }

      const stepLabel = `[Model attempt ${attempt}] Parsing response...`
      thinkingSteps.push(stepLabel)
      emit({ type: 'step', text: stepLabel })

      const { x, y, reasoning, taunt, confidence } = parseModelResponse(fullText, board)
      const allowed = analysis.candidates.slice(0, 10).some(c => c.x === x && c.y === y)
      if (!allowed && analysis.candidates.length) {
        const best = analysis.candidates[0]!
        const overrideStep = `[Model attempt ${attempt}] Overridden: chose non-candidate (${x},${y}); using (${best.x},${best.y})`
        thinkingSteps.push(overrideStep)
        emit({ type: 'step', text: overrideStep })
        emit({
          type: 'done',
          move: { x: best.x, y: best.y },
          reasoning: `${best.reason}. Model suggested (${x},${y}), but evaluator preferred the stronger tactical candidate.`,
          taunt,
          confidence: 'high',
          thinkingSteps,
        })
        return
      }
      const doneStep = `[Model attempt ${attempt}] Chose (${x},${y}): ${reasoning.slice(0, 80)}`
      thinkingSteps.push(doneStep)
      emit({ type: 'step', text: doneStep })
      emit({ type: 'done', move: { x, y }, reasoning, taunt, confidence, thinkingSteps })
      return
    } catch (err: any) {
      lastError = err.message?.slice(0, 150) ?? String(err)
      const failStep = `[Model attempt ${attempt}] Failed: ${lastError}`
      thinkingSteps.push(failStep)
      emit({ type: 'step', text: failStep })
    }
  }

  // --- fallback ---
  const candidates = getCandidateMoves(board, 1)
  const fallbackStep = '[Fallback] Using heuristic best move.'
  thinkingSteps.push(fallbackStep)
  emit({ type: 'step', text: fallbackStep })

  if (candidates.length > 0) {
    const c = candidates[0]!
    emit({ type: 'done', move: { x: c.x, y: c.y }, reasoning: 'Heuristic fallback.', taunt: '', confidence: 'low', thinkingSteps })
  } else {
    emit({ type: 'done', move: { x: 7, y: 7 }, reasoning: 'Emergency fallback.', taunt: '', confidence: 'low', thinkingSteps })
  }
}
