import { runGomokuAgent, type AIConfig, type ModelProvider } from '../utils/gomokuAgent'
import { requireAuthenticatedGame } from '../utils/supabaseAuth'
import { z } from 'zod'

const RequestSchema = z.object({
  gameId: z.number().int().positive(),
  board: z.array(z.array(z.number())).length(15),
  moves: z.array(z.object({ x: z.number(), y: z.number(), player: z.union([z.literal(1), z.literal(2)]) })),
  provider: z.enum(['openai', 'anthropic', 'deepseek', 'minimax']).default('anthropic'),
  modelName: z.string().optional(),
})

const PLACEHOLDER_KEYS = new Set(['sk-...', 'sk-ant-...', ''])

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: `Invalid request: ${parsed.error.message}` })
  }

  const { gameId, board, moves, provider, modelName } = parsed.data
  await requireAuthenticatedGame(event, gameId, 'gomoku')

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
    throw createError({
      statusCode: 500,
      message: `No API key configured for provider "${provider}". Set ${pc.envKey} in .env`,
    })
  }

  const aiConfig: AIConfig = {
    provider: provider as ModelProvider,
    apiKey,
    baseUrl,
    modelName,
    ...(provider === 'anthropic' ? {} : { temperature: 0.1 }),
  }

  try {
    const result = await runGomokuAgent({ board, moves, config: aiConfig })
    return { ok: true, ...result }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      message: `Agent error: ${err?.message || String(err)}`,
    })
  }
})
