import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GuestOnly, onSubmit } from '../../routes/guards.tsx'
import { Notice, TextField } from '../../components/ui.tsx'
import { errorMessage, requireSupabase, siteBaseUrl, supabaseConfigMessage } from '../../lib/supabase.ts'

export function SignInPage() {
  const [mode, setMode] = useState<'password' | 'link'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      if (mode === 'link') {
        const { error: linkError } = await client.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: siteBaseUrl() },
        })
        if (linkError) throw linkError
        setMessage('Check your email for a sign-in link.')
      } else {
        const { error: signInError } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError
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
        <h1 className="font-serif text-4xl">Sign in</h1>
        <p className="mt-2 text-sm text-muted">Use the email address on your ForFire account.</p>
        <div className="mt-5 flex gap-2" role="tablist" aria-label="Sign-in method">
          <button type="button" className={mode === 'password' ? 'btn btn-pine' : 'btn btn-quiet'} aria-pressed={mode === 'password'} onClick={() => setMode('password')}>
            Password
          </button>
          <button type="button" className={mode === 'link' ? 'btn btn-pine' : 'btn btn-quiet'} aria-pressed={mode === 'link'} onClick={() => setMode('link')}>
            Email link
          </button>
        </div>
        <form className="panel mt-4 space-y-4 p-5" onSubmit={onSubmit(submit)}>
          {supabaseConfigMessage ? <Notice tone="info">{supabaseConfigMessage}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          {message ? <Notice tone="success">{message}</Notice> : null}
          <TextField id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          {mode === 'password' ? (
            <TextField id="password" label="Password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          ) : null}
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'link' ? 'Email me a link' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-sm">
          <Link className="font-semibold text-ember" to="/reset-password">Forgot password</Link>
          <span className="text-muted"> · </span>
          <Link className="font-semibold text-ember" to="/sign-up">Create a student account</Link>
        </p>
      </div>
    </GuestOnly>
  )
}
