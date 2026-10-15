import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice, TextField } from '../../components/ui.tsx'
import { errorMessage, requireSupabase, siteBaseUrl, supabaseConfigMessage } from '../../lib/supabase.ts'
import { GuestOnly, onSubmit } from '../../routes/guards.tsx'

export function SignUpPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(null)
    setMessage(null)
    if (password !== confirm) {
      setError('The passwords do not match.')
      return
    }
    if (supabaseConfigMessage) {
      setError(supabaseConfigMessage)
      return
    }
    setBusy(true)
    try {
      const client = requireSupabase()
      const { data, error: signUpError } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: siteBaseUrl(),
          data: { display_name: displayName.trim() },
        },
      })
      if (signUpError) throw signUpError
      if (!data.session) {
        setMessage('Check your email to confirm the account. You will be a student until an admin appoints you as a teacher.')
      }
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <GuestOnly>
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-4xl">Create a student account</h1>
        <p className="mt-2 text-sm text-muted">Teacher access is granted later by an administrator. This form cannot choose a role.</p>
        <form className="panel mt-5 space-y-4 p-5" onSubmit={onSubmit(submit)}>
          {supabaseConfigMessage ? <Notice tone="info">{supabaseConfigMessage}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          {message ? <Notice tone="success">{message}</Notice> : null}
          <TextField id="display-name" label="Name" autoComplete="name" required minLength={2} maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          <TextField id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <TextField id="password" label="Password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} hint="At least 8 characters." />
          <TextField id="confirm" label="Confirm password" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-sm">
          Already have an account? <Link className="font-semibold text-ember" to="/sign-in">Sign in</Link>
        </p>
      </div>
    </GuestOnly>
  )
}
