import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/auth-context.ts'
import { Notice, TextField } from '../../components/ui.tsx'
import { homeForRole } from '../../lib/permissions.ts'
import { errorMessage, requireSupabase } from '../../lib/supabase.ts'
import { onSubmit } from '../../routes/guards.tsx'

export function UpdatePasswordPage() {
  const { session, profile, clearRecovery } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(null)
    if (password !== confirm) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const client = requireSupabase()
      const { error: updateError } = await client.auth.updateUser({ password })
      if (updateError) throw updateError
      clearRecovery()
      navigate(profile ? homeForRole(profile.role) : '/sign-in', { replace: true })
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-serif text-4xl">Choose a new password</h1>
      {!session ? <p className="mt-3 text-sm text-muted">Open the reset link from your email, then set a new password here.</p> : null}
      <form className="panel mt-5 space-y-4 p-5" onSubmit={onSubmit(submit)}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <TextField id="password" label="New password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
        <TextField id="confirm" label="Confirm password" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        <button className="btn btn-primary w-full" type="submit" disabled={busy || !session}>
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
