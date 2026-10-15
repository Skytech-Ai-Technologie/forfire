import { Link } from 'react-router-dom'
import { useAuth } from '../../app/auth-context.ts'
import { homeForRole } from '../../lib/permissions.ts'

export function AccessDeniedPage() {
  const { profile } = useAuth()
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ember">Access denied</p>
      <h1 className="mt-2 font-serif text-4xl">That page is outside your role.</h1>
      <p className="mt-3 text-muted">Students and teachers see different parts of ForFire. The database enforces the same boundary.</p>
      <Link className="btn btn-primary mt-6" to={profile ? homeForRole(profile.role) : '/sign-in'}>
        Go to your dashboard
      </Link>
    </div>
  )
}
