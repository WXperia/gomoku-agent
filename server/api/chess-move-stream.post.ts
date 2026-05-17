import { streamChessAgent } from '../utils/chessAgent'
import { type AIConfig, type ModelProvider } from '../utils/gomokuAgent'
import { createAIConfig } from '../utils/modelParams'
import { requireAuthenticatedGame } from '../utils/supabaseAuth'
import { z } from 'zod'

const MoveSchema = z.object({
  from: z.string().length(2),
  to: z.string().length(2),
  san: z.string(),
  lan: z.string().optional(),
  promotion: z.string().optional(),
})

const RequestSchema = z.object({
  gameId: z.number().int().positive(),
  fen: z.string().min(10),
  legalMoves: z.array(MoveSchema).min(1),
  moves: z.array(z.object({
    player: z.union([z.literal(1), z.literal(2)]),
    san: z.string().optional(),
    uci: z.string().optional(),
  })),
  provider: z.enum(['openai', 'anthropic', 'deepseek', 'minimax']).default('anthropic'),
  modelName: z.string().optional(),
  language: z.enum(['zh', 'en']).default('zh'),
})

const PLACEHOLDER_KEYS = new Set(['sk-...', 'sk-ant-...', ''])

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: `Invalid request: ${parsed.error.message}` })
  }

  const { gameId, fen, legalMoves, moves, provider, modelName, language } = parsed.data
  await requireAuthenticatedGame(event, gameId, 'chess')

  const config = useRuntimeConfig()
  type ProviderConfig = { keyField: string; urlField: string; envKey: string }
  const providerMap: Record<string, ProviderConfig> = {
    openai:    { keyField: 'openaiApiKey',    urlField: 'openaiBaseUrl',    envKey: 'OPENAI_API_KEY' },
    anthropic: { keyField: 'anthropicApiKey', urlField: 'anthropicBaseUrl', envKey: 'ANTHROPIC_API_KEY' },
    deepseek:  { keyField: 'deepseekApiKey',  urlField: 'deepseekBaseUrl',  envKey: 'DEEPSEEK_API_KEY' },
    minimax:   { keyField: 'minimaxApiKey',   urlField: 'minimaxBaseUrl',   envKey: 'MINIMAX_API_KEY' },
  }
  const pc = providerMap[provider]!
  const apiKey = (config[pc.keyField] as string) ?? ''
  const baseUrl = (config[pc.urlField] as string) || undefined
  if (PLACEHOLDER_KEYS.has(apiKey)) {
    throw createError({ statusCode: 500, message: `No API key configured for provider "${provider}". Set ${pc.envKey} in .env` })
  }

  const aiConfig: AIConfig = createAIConfig({ provider: provider as ModelProvider, apiKey, baseUrl, modelName })

  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')
  setHeader(event, 'X-Accel-Buffering', 'no')

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  const send = (data: object) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  streamChessAgent({ fen, legalMoves, moves, config: aiConfig, language }, send)
    .catch((err) => send({ type: 'error', message: err?.message || String(err) }))
    .finally(() => writer.close())

  return sendStream(event, readable)
})
