import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, LoadingBlock, Notice, PageHeader, StatusBadge } from '../../components/ui.tsx'
import {
  downloadOwnFile,
  downloadSubmissionsZip,
  fetchAssignment,
  fetchCourse,
  fetchReviewRows,
  reviewSubmission,
  submissionsToCsv,
  type SubmissionView,
} from '../../lib/api.ts'
import { formatDeadline, isLateSubmission } from '../../lib/deadlines.ts'
import { errorMessage } from '../../lib/supabase.ts'
import { formatBytes } from '../../lib/validation.ts'
import { onSubmit } from '../../routes/guards.tsx'

export function ReviewPage() {
  const { assignmentId = '' } = useParams()
  const [title, setTitle] = useState('Assignment')
  const [courseName, setCourseName] = useState('Course')
  const [timezone, setTimezone] = useState('UTC')
  const [dueAt, setDueAt] = useState('')
  const [rows, setRows] = useState<SubmissionView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'submitted' | 'reviewed'>('all')
  const [lateOnly, setLateOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const assignment = await fetchAssignment(assignmentId)
      if (!assignment) throw new Error('Assignment not found.')
      const course = await fetchCourse(assignment.course_id)
      const nextRows = await fetchReviewRows(assignmentId)
      setTitle(assignment.title)
      setCourseName(course?.name ?? 'Course')
      setTimezone(course?.timezone ?? 'UTC')
      setDueAt(assignment.due_at)
      setRows(nextRows.map((row) => ({ ...row, due_at: assignment.due_at, timezone: course?.timezone ?? 'UTC', course_name: course?.name })))
      setError(null)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [assignmentId])

  const visible = useMemo(() => {
    return rows.filter((row) => {
      const haystack = `${row.student_name ?? ''} ${row.student_code ?? ''} ${row.original_filename}`.toLowerCase()
      if (query && !haystack.includes(query.toLowerCase())) return false
      if (status !== 'all' && row.status !== status) return false
      if (lateOnly && !(row.submitted_at && isLateSubmission(row.submitted_at, dueAt))) return false
      return true
    })
  }, [rows, query, status, lateOnly, dueAt])

  const selected = rows.find((row) => row.id === selectedId) ?? null

  useEffect(() => {
    setFeedback(selected?.feedback ?? '')
  }, [selected?.id, selected?.feedback])

  async function saveFeedback() {
    if (!selected) return
    setBusy(true)
    setMessage(null)
    try {
      await reviewSubmission(selected.id, feedback)
      setMessage('Feedback saved. The student can read it on their own submission.')
      await load()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  function exportCsv() {
    const csv = submissionsToCsv(visible, courseName, title)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${courseName}-${title}-submissions.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <LoadingBlock label="Loading submissions…" />
  if (error && rows.length === 0) return <Notice tone="error">{error}</Notice>

  return (
    <div>
      <PageHeader eyebrow={courseName} title={title}>
        <Link className="btn btn-quiet" to={`/teacher/assignments/${assignmentId}/edit`}>Edit assignment</Link>
      </PageHeader>
      <p className="mb-4 text-sm text-muted">
        Deadline {dueAt ? formatDeadline(dueAt, timezone) : 'not set'}. Late means the server recorded the file after that instant.
        Files are downloaded, never opened or run in ForFire.
      </p>
      {message ? <div className="mb-4"><Notice tone="success">{message}</Notice></div> : null}
      {error ? <div className="mb-4"><Notice tone="error">{error}</Notice></div> : null}
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm font-semibold" htmlFor="filter-q">
          Search
          <input id="filter-q" className="field ml-2 font-normal" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="text-sm font-semibold" htmlFor="filter-status">
          Status
          <select id="filter-status" className="field ml-2 font-normal" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="late-only">
          <input id="late-only" type="checkbox" checked={lateOnly} onChange={(event) => setLateOnly(event.target.checked)} />
          Late only
        </label>
        <button type="button" className="btn btn-quiet" onClick={exportCsv} disabled={visible.length === 0}>Export CSV</button>
        <button
          type="button"
          className="btn btn-pine"
          disabled={visible.length === 0 || busy}
          onClick={() => {
            setBusy(true)
            void downloadSubmissionsZip(visible, courseName, title)
              .catch((reason: unknown) => setError(errorMessage(reason)))
              .finally(() => setBusy(false))
          }}
        >
          Download ZIP
        </button>
      </div>
      {visible.length === 0 ? <EmptyState title="No submissions match" /> : null}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">File</th>
                <th className="px-2 py-2">Submitted</th>
                <th className="px-2 py-2">State</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const late = row.submitted_at ? isLateSubmission(row.submitted_at, dueAt) : false
                return (
                  <tr key={row.id} className={selectedId === row.id ? 'bg-pine-soft' : ''}>
                    <td className="px-2 py-3">
                      <button type="button" className="text-left font-semibold" onClick={() => setSelectedId(row.id)}>
                        {row.student_name}
                      </button>
                      <div className="text-muted">{row.student_code ?? 'No student ID'}</div>
                    </td>
                    <td className="px-2 py-3">{row.original_filename}<div className="text-muted">{formatBytes(row.size_bytes)} · v{row.version_number}</div></td>
                    <td className="px-2 py-3">{row.submitted_at ? formatDeadline(row.submitted_at, timezone) : '—'}{late ? <div className="font-semibold text-ember">Late</div> : null}</td>
                    <td className="px-2 py-3"><StatusBadge value={row.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <aside className="panel p-5">
          {selected ? (
            <form className="space-y-3" onSubmit={onSubmit(saveFeedback)}>
              <h2 className="font-serif text-2xl">{selected.student_name}</h2>
              <p className="text-sm">{selected.original_filename}</p>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => void downloadOwnFile(selected.storage_path, selected.original_filename).catch((reason: unknown) => setError(errorMessage(reason)))}
              >
                Download privately
              </button>
              <label className="block text-sm font-semibold" htmlFor="feedback">
                Private feedback
                <textarea id="feedback" className="field mt-1 min-h-32 font-normal" maxLength={5000} value={feedback} onChange={(event) => setFeedback(event.target.value)} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Mark reviewed'}</button>
            </form>
          ) : (
            <p className="text-sm text-muted">Select a submission to leave feedback.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
