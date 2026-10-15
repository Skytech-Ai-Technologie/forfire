import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  ''

export const supabaseUrl = url
export const supabasePublishableKey = publishableKey

export const supabaseConfigMessage =
  url && publishableKey
    ? null
    : 'Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before signing in. See .env.example.'

const initialParams = new URLSearchParams(window.location.search)
export const initialAuthType = initialParams.get('type')

export const supabase: SupabaseClient | null =
  url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error(supabaseConfigMessage ?? 'Supabase is not configured.')
  return supabase
}

export function siteBaseUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return 'Something went wrong. Try again.'
}
