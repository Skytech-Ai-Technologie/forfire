import type { FormEvent, ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../app/auth-context.ts'
import { LoadingBlock } from '../components/ui.tsx'
import { homeForRole, safeNext } from '../lib/permissions.ts'
import type { UserRole } from '../types/database.ts'

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingBlock label="Checking your session…" />
  if (!session) {
    const next = safeNext(`${location.pathname}${location.search}`, '/student')
    return <Navigate to={`/sign-in?next=${encodeURIComponent(next)}`} replace />
  }
  if (!profile) return <LoadingBlock label="Loading your profile…" />
  if (!roles.includes(profile.role)) return <Navigate to="/access-denied" replace />
  return children
}

export function RecoveryGate({ children }: { children: ReactNode }) {
  const { recovery, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingBlock label="Checking your session…" />
  if (recovery && location.pathname !== '/update-password') return <Navigate to="/update-password" replace />
  return children
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { session, profile, loading, recovery } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingBlock label="Checking your session…" />
  if (recovery) return <Navigate to="/update-password" replace />
  if (session && profile) {
    const params = new URLSearchParams(location.search)
    return <Navigate to={safeNext(params.get('next'), homeForRole(profile.role))} replace />
  }
  return children
}

export function onSubmit(handler: () => Promise<void> | void) {
  return (event: FormEvent) => {
    event.preventDefault()
    void handler()
  }
}
