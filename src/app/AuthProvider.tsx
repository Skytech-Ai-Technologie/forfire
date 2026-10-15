import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { fetchMyProfile } from '../lib/api.ts'
import { initialAuthType, supabase, supabaseConfigMessage } from '../lib/supabase.ts'
import type { Profile } from '../types/database.ts'
import { AuthContext } from './auth-context.ts'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [recovery, setRecovery] = useState(initialAuthType === 'recovery')

  const refreshProfile = useCallback(async () => {
    if (!supabase || !session?.user) {
      setProfile(null)
      return
    }
    const next = await fetchMyProfile(session.user.id)
    setProfile(next)
  }, [session?.user])

  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase) return
    let active = true
    if (!session?.user) {
      setProfile(null)
      return
    }
    setLoading(true)
    fetchMyProfile(session.user.id)
      .then((next) => {
        if (active) setProfile(next)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session?.user])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setRecovery(false)
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({
      configured: supabaseConfigMessage === null,
      session,
      profile,
      loading,
      recovery,
      clearRecovery: () => setRecovery(false),
      refreshProfile,
      signOut,
    }),
    [session, profile, loading, recovery, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
