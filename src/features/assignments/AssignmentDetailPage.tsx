import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../app/auth-context.ts'
import { EmptyState, LoadingBlock, Notice, StatusBadge } from '../../components/ui.tsx'
import { downloadOwnFile, fetchAssignmentForStudent, fetchMySubmissions, type SubmissionView } from '../../lib/api.ts'
import { formatDeadline, isLateSubmission } from '../../lib/deadlines.ts'
import { errorMessage } from '../../lib/supabase.ts'
import { cancelPendingSubmission, submitAssignmentFile } from '../../lib/upload.ts'
import { formatBytes } from '../../lib/validation.ts'
import { onSubmit } from '../../routes/guards.tsx'

export function AssignmentDetailPage() {
  const { assignmentId = '' } = useParams()
  const { session } = useAuth()
  const [assignment, setAssignment] = useState<Awaited<ReturnType<typeof fetchAssignmentForStudent>>>(null)
  const [submissions, setSubmissions] = useState<SubmissionView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const lock = useRef(false)

  async function load() {
    if (!session?.user) return
    setLoading(true)
    try {
      const [nextAssignment, nextSubmissions] = await Promise.all([
        fetchAssignmentForStudent(assignmentId),
        fetchMySubmissions(session.user.id, assignmentId),
      ])
      setAssignment(nextAssignment)
      setSubmissions(nextSubmissions)
      setError(null)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // Reload when the signed-in student or assignment changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, session?.user.id])

  const finished = submissions.filter((item) => item.status !== 'pending')
  const pending = submissions.find((item) => item.status === 'pending')
  const blocked =
    assignment?.status !== 'published' ||
    (!assignment.allow_resubmission && finished.length > 0) ||
    Boolean(pending)

  async function upload() {
    if (!assignment || !file || lock.current) return
    lock.current = true
    setFormError(null)
    setNotice(null)
    setProgress(0)
    try {
      await submitAssignmentFile({
        assignmentId: assignment.id,
        file,
        allowedExtensions: assignment.allowed_extensions,
        maxFileSizeBytes: assignment.max_file_size_bytes,
        onProgress: setProgress,
      })
      setFile(null)
      setNotice('Submission recorded. The timestamp comes from the server.')
      await load()
    } catch (reason) {
      setFormError(errorMessage(reason))
    } finally {
      setProgress(null)
      lock.current = false
    }
  }

  async function cancelPending() {
    if (!pending) return
    setFormError(null)
    try {
      await cancelPendingSubmission(pending.id)
      setNotice('The unfinished upload was cancelled.')
      await load()
    } catch (reason) {
      setFormError(errorMessage(reason))
    }
  }

  if (loading) return <LoadingBlock label="Loading assignment…" />
  if (error) return <Notice tone="error">{error}</Notice>
  if (!assignment) {
    return (
      <EmptyState title="Assignment not available">
        It may be a draft, or you may not be enrolled. <Link className="font-semibold text-ember" to="/student">Back to the dashboard</Link>
      </EmptyState>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <article className="panel p-6">
        <p className="text-sm font-semibold text-pine">{assignment.course_code} · {assignment.course_name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-4xl">{assignment.title}</h1>
          <StatusBadge value={assignment.status} />
        </div>
        <p className="mt-3 text-sm">Due {formatDeadline(assignment.due_at, assignment.timezone)}</p>
        <p className="mt-1 text-sm text-muted">Late or on time is decided when the server confirms the file, using this course time zone.</p>
        <div className="mt-5 whitespace-pre-wrap text-[15px] leading-7">{assignment.instructions || 'No extra instructions.'}</div>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-semibold">Accepted types</dt>
            <dd>{assignment.allowed_extensions.join(', ')}</dd>
          </div>
          <div>
            <dt className="font-semibold">Maximum size</dt>
            <dd>{formatBytes(assignment.max_file_size_bytes)}</dd>
          </div>
          <div>
            <dt className="font-semibold">Resubmission</dt>
            <dd>{assignment.allow_resubmission ? 'Allowed. Earlier versions stay on record.' : 'Not allowed.'}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-muted">ForFire downloads files. It does not open or run HTML, scripts, or notebooks.</p>
      </article>
      <aside className="space-y-4">
        <form className="panel space-y-4 p-5" onSubmit={onSubmit(upload)}>
          <h2 className="font-serif text-2xl">Upload</h2>
          {notice ? <Notice tone="success">{notice}</Notice> : null}
          {formError ? <Notice tone="error">{formError}</Notice> : null}
          {pending ? (
            <div className="space-y-3">
              <Notice tone="info">An earlier upload did not finish. Cancel it before sending another file.</Notice>
              <button type="button" className="btn btn-quiet" onClick={() => void cancelPending()}>
                Cancel unfinished upload
              </button>
            </div>
          ) : null}
          <label className="block text-sm font-semibold" htmlFor="submission-file">
            File
            <input
              id="submission-file"
              className="field mt-1 font-normal"
              type="file"
              accept={assignment.allowed_extensions.map((ext) => `.${ext}`).join(',')}
              disabled={blocked}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          {file ? <p className="text-sm">{file.name} · {formatBytes(file.size)}</p> : null}
          {progress !== null ? (
            <div>
              <progress className="w-full" value={progress} max={100}>{progress}%</progress>
              <p className="text-sm text-muted" role="status">Uploading {progress}%</p>
            </div>
          ) : null}
          <button className="btn btn-primary w-full" type="submit" disabled={blocked || !file || progress !== null}>
            {progress !== null ? 'Uploading…' : 'Submit file'}
          </button>
          {assignment.status !== 'published' ? <p className="text-sm text-muted">This assignment is closed.</p> : null}
          {!assignment.allow_resubmission && finished.length > 0 ? <p className="text-sm text-muted">You already submitted, and resubmission is off.</p> : null}
        </form>
        <section className="panel p-5">
          <h2 className="font-serif text-2xl">Your files</h2>
          {finished.length === 0 ? <p className="mt-3 text-sm text-muted">Nothing submitted yet.</p> : null}
          <ul className="mt-3 space-y-4">
            {finished.map((item) => (
              <li key={item.id} className="border-t border-line pt-3 text-sm first:border-0 first:pt-0">
                <p className="font-semibold">{item.original_filename}</p>
                <p>Version {item.version_number} · {formatBytes(item.size_bytes)}</p>
                <p>{item.submitted_at ? formatDeadline(item.submitted_at, assignment.timezone) : 'Time not recorded'}</p>
                {item.submitted_at && isLateSubmission(item.submitted_at, assignment.due_at) ? <p className="font-semibold text-ember">Late</p> : <p>On time</p>}
                <p className="capitalize">{item.status}</p>
                {item.feedback ? <p className="mt-2 whitespace-pre-wrap rounded-xl bg-pine-soft p-3">Feedback: {item.feedback}</p> : null}
                <button type="button" className="btn btn-quiet mt-2" onClick={() => void downloadOwnFile(item.storage_path, item.original_filename).catch((reason: unknown) => setFormError(errorMessage(reason)))}>
                  Download
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  )
}
