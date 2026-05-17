import { createClient } from '@supabase/supabase-js'

type GameKind = 'gomoku' | 'xiangqi'

type AuthenticatedGame = {
  userId: string
  gameId: number
}

function getSupabaseServerClient() {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseKey = config.public.supabasePublishableKey

  if (!supabaseUrl || !supabaseKey) {
    throw createError({
      statusCode: 500,
      message: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.',
    })
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function requireAuthenticatedGame(
  event: Parameters<typeof getHeader>[0],
  gameId: number,
  expectedKind: GameKind,
): Promise<AuthenticatedGame> {
  const authHeader = getHeader(event, 'authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    throw createError({ statusCode: 401, message: 'Missing Authorization bearer token.' })
  }

  const supabase = getSupabaseServerClient()
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  const user = userData.user

  if (userError || !user) {
    throw createError({ statusCode: 401, message: 'Invalid or expired Supabase session.' })
  }

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id,status,game_kind,auth_user_id')
    .eq('id', gameId)
    .maybeSingle()

  if (gameError) {
    throw createError({ statusCode: 500, message: `Failed to verify game ownership: ${gameError.message}` })
  }

  if (!game) {
    throw createError({ statusCode: 404, message: 'Game not found.' })
  }

  if (game.status !== 'playing') {
    throw createError({ statusCode: 409, message: 'Game is not active.' })
  }

  if (game.game_kind !== expectedKind) {
    throw createError({ statusCode: 400, message: `Game kind mismatch. Expected ${expectedKind}.` })
  }

  if (game.auth_user_id !== user.id) {
    throw createError({ statusCode: 403, message: 'This game does not belong to the current session.' })
  }

  return { userId: user.id, gameId }
}
