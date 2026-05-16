import { createClient } from '@supabase/supabase-js'

let _client: ReturnType<typeof createClient> | null = null

export function useSupabase() {
  if (_client) return _client
  const config = useRuntimeConfig()
  _client = createClient(
    config.public.supabaseUrl,
    config.public.supabasePublishableKey,
  )
  return _client
}
