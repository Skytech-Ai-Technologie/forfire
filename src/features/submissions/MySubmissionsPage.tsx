import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/auth-context.ts'
import { EmptyState, LoadingBlock, Notice, PageHeader } from '../../components/ui.tsx'
import { downloadOwnFile, fetchMySubmissions, type SubmissionView } from '../../lib/api.ts'
import { formatDeadline, isLateSubmission } from '../../lib/deadlines.ts'
import { errorMessage } from '../../lib/supabase.ts'
import { formatBytes } from '../../lib/validation.ts'

export function MySubmissionsPage() {
  const { session } = useAuth()
  const [rows, setRows] = useState<SubmissionView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user) return
    let active = true
    fetchMySubmissions(session.user.id)
      .then((next) => {
        if (active) setRows(next.filter((row) => row.status !== 'pending'))
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session?.user.id])

  return (
    <div>
      <PageHeader eyebrow="Student" title="My submissions" />
      {loading ? <LoadingBlock /> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!loading && rows.length === 0 ? <EmptyState title="No submissions yet" /> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-separate border-spacing-y-3 text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-3 font-semibold">Assignment</th>
              <th className="px-3 font-semibold">File</th>
              <th className="px-3 font-semibold">Submitted</th>
              <th className="px-3 font-semibold">Status</th>
              <th className="px-3 font-semibold">File</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const late = row.submitted_at && row.due_at ? isLateSubmission(row.submitted_at, row.due_at) : false
              return (
                <tr key={row.id} className="bg-card">
                  <td className="rounded-l-2xl px-3 py-3">
                    <Link className="font-semibold text-ember" to={`/student/assignments/${row.assignment_id}`}>{row.assignment_title ?? 'Assignment'}</Link>
                    <div className="text-muted">{row.course_name}</div>
                  </td>
                  <td className="px-3 py-3">{row.original_filename}<div className="text-muted">{formatBytes(row.size_bytes)} · v{row.version_number}</div></td>
                  <td className="px-3 py-3">{row.submitted_at ? formatDeadline(row.submitted_at, row.timezone ?? 'UTC') : '—'}{late ? <div className="font-semibold text-ember">Late</div> : null}</td>
                  <td className="px-3 py-3 capitalize">{row.status}{row.feedback ? <div className="max-w-xs whitespace-pre-wrap text-muted">{row.feedback}</div> : null}</td>
                  <td className="rounded-r-2xl px-3 py-3">
                    <button type="button" className="btn btn-quiet" onClick={() => void downloadOwnFile(row.storage_path, row.original_filename).catch((reason: unknown) => setError(errorMessage(reason)))}>
                      Download
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
