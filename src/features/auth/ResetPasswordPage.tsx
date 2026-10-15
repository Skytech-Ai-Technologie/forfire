import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice, TextField } from '../../components/ui.tsx'
import { errorMessage, requireSupabase, siteBaseUrl, supabaseConfigMessage } from '../../lib/supabase.ts'
import { GuestOnly, onSubmit } from '../../routes/guards.tsx'

export function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(null)
    setMessage(null)
    if (supabaseConfigMessage) {
      setError(supabaseConfigMessage)
      return
    }
    setBusy(true)
    try {
      const client = requireSupabase()
      const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: siteBaseUrl(),
      })
      if (resetError) throw resetError
      setMessage('If an account exists for that email, a reset link is on its way.')
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <GuestOnly>
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-4xl">Reset password</h1>
        <form className="panel mt-5 space-y-4 p-5" onSubmit={onSubmit(submit)}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {message ? <Notice tone="success">{message}</Notice> : null}
          <TextField id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="mt-4 text-sm">
          <Link className="font-semibold text-ember" to="/sign-in">Back to sign in</Link>
        </p>
      </div>
    </GuestOnly>
  )
}
