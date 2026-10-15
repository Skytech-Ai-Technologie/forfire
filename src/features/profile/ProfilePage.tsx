import { useState } from 'react'
import { useAuth } from '../../app/auth-context.ts'
import { Notice, PageHeader, TextField } from '../../components/ui.tsx'
import { updateMyProfile } from '../../lib/api.ts'
import { errorMessage } from '../../lib/supabase.ts'
import { onSubmit } from '../../routes/guards.tsx'

export function ProfilePage() {
  const { session, profile, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [studentId, setStudentId] = useState(profile?.student_id ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lockedId = Boolean(profile?.student_id)

  async function save() {
    if (!profile) return
    setMessage(null)
    setError(null)
    setBusy(true)
    try {
      await updateMyProfile({
        id: profile.id,
        displayName,
        studentId: lockedId ? undefined : studentId,
      })
      await refreshProfile()
      setMessage('Profile saved.')
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader eyebrow="Account" title="Profile" />
      <form className="panel space-y-4 p-5" onSubmit={onSubmit(save)}>
        {message ? <Notice tone="success">{message}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <TextField id="email" label="Email" value={session?.user.email ?? ''} disabled readOnly />
        <TextField id="role" label="Role" value={profile?.role ?? ''} disabled readOnly hint="An administrator changes roles. This page cannot." />
        <TextField id="display-name" label="Name" required minLength={2} maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        <TextField
          id="student-id"
          label="Student ID"
          value={studentId}
          disabled={lockedId}
          pattern="[A-Za-z0-9][A-Za-z0-9-]{1,31}"
          onChange={(event) => setStudentId(event.target.value)}
          hint={lockedId ? 'A student ID can be set once.' : 'Optional. 2–32 letters, numbers, or hyphens. Your teacher uses this to enroll you.'}
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  )
}
