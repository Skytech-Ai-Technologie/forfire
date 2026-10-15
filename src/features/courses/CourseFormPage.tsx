import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Notice, PageHeader, TextAreaField, TextField } from '../../components/ui.tsx'
import { createCourse } from '../../lib/api.ts'
import { browserTimeZone, timeZoneOptions } from '../../lib/deadlines.ts'
import { errorMessage } from '../../lib/supabase.ts'
import { onSubmit } from '../../routes/guards.tsx'

export function CourseFormPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [description, setDescription] = useState('')
  const [timezone, setTimezone] = useState(browserTimeZone())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const zones = timeZoneOptions()

  async function save() {
    setError(null)
    setBusy(true)
    try {
      const id = await createCourse({ name, courseCode, description, timezone })
      navigate(`/teacher/courses/${id}`)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Teacher" title="New course" />
      <form className="panel space-y-4 p-5" onSubmit={onSubmit(save)}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <TextField id="name" label="Course name" required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} />
        <TextField id="code" label="Course code" required pattern="[A-Za-z0-9][A-Za-z0-9._-]{1,31}" value={courseCode} onChange={(event) => setCourseCode(event.target.value)} hint="Students use this code to request a seat. Example: HIST210" />
        <TextAreaField id="description" label="Description" value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} />
        <label className="block text-sm font-semibold" htmlFor="timezone">
          Time zone
          <select id="timezone" className="field mt-1 font-normal" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {zones.map((zone) => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
          <span className="mt-1 block font-normal text-muted">Deadlines for this course are entered and shown in this time zone.</span>
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create course'}</button>
      </form>
    </div>
  )
}
