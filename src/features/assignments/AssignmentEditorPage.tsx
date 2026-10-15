import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LoadingBlock, Notice, PageHeader, TextAreaField, TextField } from '../../components/ui.tsx'
import { fetchAssignment, fetchCourse, saveAssignment } from '../../lib/api.ts'
import { utcIsoToZonedInput, zonedLocalToUtcIso } from '../../lib/deadlines.ts'
import { errorMessage } from '../../lib/supabase.ts'
import { PLATFORM_EXTENSIONS, PLATFORM_MAX_BYTES } from '../../lib/validation.ts'
import type { AssignmentStatus } from '../../types/database.ts'
import { onSubmit } from '../../routes/guards.tsx'

export function AssignmentEditorPage() {
  const { courseId: routeCourseId, assignmentId } = useParams()
  const navigate = useNavigate()
  const [courseId, setCourseId] = useState(routeCourseId ?? '')
  const [timezone, setTimezone] = useState('UTC')
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [dueLocal, setDueLocal] = useState('')
  const [extensions, setExtensions] = useState<string[]>([...PLATFORM_EXTENSIONS])
  const [maxMb, setMaxMb] = useState(20)
  const [allowResubmission, setAllowResubmission] = useState(false)
  const [loading, setLoading] = useState(Boolean(assignmentId))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (assignmentId) {
        const assignment = await fetchAssignment(assignmentId)
        if (!assignment) throw new Error('Assignment not found.')
        const course = await fetchCourse(assignment.course_id)
        if (!active) return
        setCourseId(assignment.course_id)
        setTimezone(course?.timezone ?? 'UTC')
        setTitle(assignment.title)
        setInstructions(assignment.instructions)
        setDueLocal(utcIsoToZonedInput(assignment.due_at, course?.timezone ?? 'UTC'))
        setExtensions(assignment.allowed_extensions)
        setMaxMb(Math.max(1, Math.round(assignment.max_file_size_bytes / (1024 * 1024))))
        setAllowResubmission(assignment.allow_resubmission)
      } else if (routeCourseId) {
        const course = await fetchCourse(routeCourseId)
        if (!active) return
        setTimezone(course?.timezone ?? 'UTC')
      }
    }
    load()
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [assignmentId, routeCourseId])

  function toggleExtension(extension: string) {
    setExtensions((current) =>
      current.includes(extension) ? current.filter((item) => item !== extension) : [...current, extension],
    )
  }

  async function save(status: AssignmentStatus) {
    setError(null)
    const bytes = Math.round(maxMb * 1024 * 1024)
    if (!courseId) {
      setError('Choose a course first.')
      return
    }
    if (extensions.length === 0) {
      setError('Choose at least one file type.')
      return
    }
    if (bytes < 1 || bytes > PLATFORM_MAX_BYTES) {
      setError('Maximum size must be from 1 MB to 20 MB.')
      return
    }
    setBusy(true)
    try {
      const id = await saveAssignment({
        id: assignmentId,
        courseId,
        title,
        instructions,
        dueAt: zonedLocalToUtcIso(dueLocal, timezone),
        allowedExtensions: extensions,
        maxFileSizeBytes: bytes,
        allowResubmission,
        status,
      })
      navigate(`/teacher/assignments/${id}/review`)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock label="Loading assignment…" />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={timezone} title={assignmentId ? 'Edit assignment' : 'New assignment'} />
      <form className="panel space-y-4 p-5" onSubmit={onSubmit(() => save('published'))}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <TextField id="title" label="Title" required minLength={2} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextAreaField id="instructions" label="Instructions" value={instructions} maxLength={10000} onChange={(event) => setInstructions(event.target.value)} />
        <TextField
          id="due"
          label="Deadline"
          type="datetime-local"
          required
          value={dueLocal}
          onChange={(event) => setDueLocal(event.target.value)}
          hint={`This time is ${timezone}, not the time zone on your laptop. 18:00 means 18:00 in ${timezone}.`}
        />
        <fieldset>
          <legend className="text-sm font-semibold">Accepted file types</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PLATFORM_EXTENSIONS.map((extension) => (
              <label key={extension} className="flex items-center gap-2 text-sm" htmlFor={`ext-${extension}`}>
                <input id={`ext-${extension}`} type="checkbox" checked={extensions.includes(extension)} onChange={() => toggleExtension(extension)} />
                .{extension}
              </label>
            ))}
          </div>
        </fieldset>
        <TextField id="max-mb" label="Maximum file size (MB)" type="number" min={1} max={20} step={1} required value={maxMb} onChange={(event) => setMaxMb(Number(event.target.value))} />
        <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="resubmit">
          <input id="resubmit" type="checkbox" checked={allowResubmission} onChange={(event) => setAllowResubmission(event.target.checked)} />
          Allow resubmission and keep earlier versions
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-quiet" type="button" disabled={busy} onClick={() => void save('draft')}>Save draft</button>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Publish'}</button>
          {assignmentId ? (
            <button className="btn btn-quiet" type="button" disabled={busy} onClick={() => void save('archived')}>Archive</button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
