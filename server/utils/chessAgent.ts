import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLLM, type AIConfig, type UserLanguage } from './gomokuAgent'

export interface ChessLegalMove {
  from: string
  to: string
  san: string
  lan?: string
  promotion?: string
}

const SYSTEM_PROMPT = `You are a strong chess player. You play Black. The human plays White.

Choose exactly one move from the legal move list. Do not invent moves.
Respond with ONLY JSON:
{"from":"e7","to":"e5","promotion":"","reasoning":"short chess reason","confidence":"high|medium|low","taunt":"short optional taunt"}`

function hasCjk(text: string) {
  return /[\u3400-\u9fff]/.test(text)
}

function fallbackTaunt(language: UserLanguage) {
  return language === 'zh' ? '这步棋很干净，压力现在回到你那边。' : 'Clean move. The pressure is back on you.'
}

function normalizeTaunt(text: string, language: UserLanguage) {
  const trimmed = text.trim()
  if (!trimmed) return fallbackTaunt(language)
  if (language === 'zh') return hasCjk(trimmed) ? trimmed : fallbackTaunt(language)
  return hasCjk(trimmed) ? fallbackTaunt(language) : trimmed
}

function languageInstruction(language: UserLanguage) {
  return language === 'zh'
    ? 'The user interface language is Simplified Chinese. The "taunt" field MUST be Simplified Chinese.'
    : 'The user interface language is English. The "taunt" field MUST be English.'
}

function parseResponse(raw: string, legalMoves: ChessLegalMove[], language: UserLanguage) {
  const jsonMatch = raw.match(/\{[\s\S]*?\}/)
  if (!jsonMatch) throw new Error(`No JSON found in response: ${raw.slice(0, 120)}`)
  const parsed = JSON.parse(jsonMatch[0])
  const from = String(parsed.from ?? '')
  const to = String(parsed.to ?? '')
  const promotion = String(parsed.promotion ?? '')
  const legal = legalMoves.find(move => move.from === from && move.to === to && (move.promotion || '') === promotion)
    ?? legalMoves.find(move => move.from === from && move.to === to)
  if (!legal) throw new Error(`Model chose an illegal move: ${from}-${to}`)

  const confidence = (['high', 'medium', 'low'] as const).includes(parsed.confidence)
    ? parsed.confidence as 'high' | 'medium' | 'low'
    : 'medium'

  return {
    move: { from: legal.from, to: legal.to, promotion: legal.promotion },
    san: legal.san,
    reasoning: String(parsed.reasoning ?? ''),
    taunt: normalizeTaunt(String(parsed.taunt ?? ''), language),
    confidence,
  }
}

export async function runChessAgent(input: {
  fen: string
  legalMoves: ChessLegalMove[]
  moves: Array<{ san?: string; uci?: string; player: 1 | 2 }>
  config: AIConfig
  language?: UserLanguage
}) {
  const llm = createLLM(input.config)
  const language = input.language ?? 'zh'
  const thinkingSteps = [`[Rules] Received ${input.legalMoves.length} legal chess moves.`]
  const recent = input.moves.slice(-10).map(move => `${move.player === 1 ? 'White' : 'Black'} ${move.san || move.uci || ''}`).join('\n')
  const legal = input.legalMoves.map((move, index) => `${index + 1}. ${move.san} JSON={"from":"${move.from}","to":"${move.to}","promotion":"${move.promotion ?? ''}"}`).join('\n')
  const prompt = `FEN:
${input.fen}

Recent moves:
${recent || '(none)'}

Language rule:
${languageInstruction(language)}

Legal Black moves:
${legal}

Pick the best legal Black move.`

  let lastError = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await llm.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(lastError ? `${prompt}\n\nPrevious response error: ${lastError}. Choose only from the legal move list.` : prompt),
    ])
    const raw = typeof response.content === 'string'
      ? response.content
      : (response.content as any[])[0]?.text ?? ''

    try {
      const parsed = parseResponse(raw, input.legalMoves, language)
      thinkingSteps.push(`[Model attempt ${attempt}] ${parsed.san}: ${parsed.reasoning.slice(0, 100)}`)
      return { ...parsed, thinkingSteps }
    } catch (err: any) {
      lastError = err?.message || String(err)
      thinkingSteps.push(`[Model attempt ${attempt}] Invalid: ${lastError.slice(0, 140)}`)
    }
  }

  throw new Error('Chess agent failed to choose a legal move')
}

export async function streamChessAgent(
  input: Parameters<typeof runChessAgent>[0],
  emit: (event: { type: 'step'; text: string } | { type: 'done'; move: { from: string; to: string; promotion?: string }; san: string; reasoning: string; taunt: string; confidence: 'high' | 'medium' | 'low'; thinkingSteps: string[] } | { type: 'error'; message: string }) => void,
) {
  emit({ type: 'step', text: `[Rules] Received ${input.legalMoves.length} legal chess moves.` })
  const result = await runChessAgent(input)
  for (const step of result.thinkingSteps.slice(1)) emit({ type: 'step', text: step })
  emit({ type: 'done', ...result })
}
