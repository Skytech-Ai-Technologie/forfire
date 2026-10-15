import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/auth-context.ts'
import { EmptyState, LoadingBlock, Notice, PageHeader, StatusBadge, TextField } from '../../components/ui.tsx'
import { fetchStudentAssignments, requestEnrollment, type StudentAssignment } from '../../lib/api.ts'
import { formatDeadline } from '../../lib/deadlines.ts'
import { errorMessage } from '../../lib/supabase.ts'
import { useAsyncData } from '../../lib/use-async-data.ts'
import { onSubmit } from '../../routes/guards.tsx'

export function StudentDashboardPage() {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const { data, error, loading, reload } = useAsyncData(() => fetchStudentAssignments(userId), [userId])
  const [courseCode, setCourseCode] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function requestSeat() {
    setNotice(null)
    setFormError(null)
    setBusy(true)
    try {
      await requestEnrollment(courseCode)
      setCourseCode('')
      setNotice('Request sent. Your teacher needs to approve it before the assignments appear.')
      reload()
    } catch (reason) {
      setFormError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Student" title="Your assignments" />
      <form className="panel mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end" onSubmit={onSubmit(requestSeat)}>
        <div className="flex-1">
          <TextField id="course-code" label="Course code" value={courseCode} required onChange={(event) => setCourseCode(event.target.value)} hint="Ask your teacher for the code, then wait for approval." />
        </div>
        <button className="btn btn-pine" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Request a seat'}
        </button>
      </form>
      {notice ? <div className="mb-4"><Notice tone="success">{notice}</Notice></div> : null}
      {formError ? <div className="mb-4"><Notice tone="error">{formError}</Notice></div> : null}
      {loading ? <LoadingBlock label="Loading assignments…" /> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!loading && data && data.length === 0 ? (
        <EmptyState title="No assignments yet">
          When a teacher enrolls you, published work will show up here.
        </EmptyState>
      ) : null}
      <div className="grid gap-4">
        {data?.map((assignment) => (
          <AssignmentCard key={assignment.id} assignment={assignment} />
        ))}
      </div>
    </div>
  )
}

function AssignmentCard({ assignment }: { assignment: StudentAssignment }) {
  const [openedAt] = useState(() => Date.now())
  const pastDue = openedAt > Date.parse(assignment.due_at)
  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-pine">{assignment.course_code} · {assignment.course_name}</p>
          <h2 className="mt-1 font-serif text-2xl">{assignment.title}</h2>
        </div>
        <StatusBadge value={assignment.status} />
      </div>
      <p className="mt-3 text-sm">Due {formatDeadline(assignment.due_at, assignment.timezone)}</p>
      {pastDue ? (
        <p className="mt-1 text-sm text-muted">Your device clock says this deadline has passed. The server clock decides whether an upload is late.</p>
      ) : null}
      <Link className="btn btn-primary mt-4" to={`/student/assignments/${assignment.id}`}>
        Open assignment
      </Link>
    </article>
  )
}
