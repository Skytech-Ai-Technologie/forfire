import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, LoadingBlock, Notice, PageHeader, StatusBadge, TextAreaField, TextField } from '../../components/ui.tsx'
import {
  addCourseTeacher,
  decideEnrollment,
  enrollByStudentId,
  fetchCourse,
  fetchCourseAssignments,
  fetchCourseMembers,
  fetchPendingRequests,
  updateCourse,
  type CourseMemberView,
} from '../../lib/api.ts'
import { timeZoneOptions } from '../../lib/deadlines.ts'
import { errorMessage } from '../../lib/supabase.ts'
import type { Assignment, Course, EnrollmentRequest } from '../../types/database.ts'
import { onSubmit } from '../../routes/guards.tsx'

export function CourseDetailPage() {
  const { courseId = '' } = useParams()
  const [course, setCourse] = useState<Course | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [members, setMembers] = useState<CourseMemberView[]>([])
  const [requests, setRequests] = useState<Array<EnrollmentRequest & { display_name: string; student_code: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [studentId, setStudentId] = useState('')
  const [teacherEmail, setTeacherEmail] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [nextCourse, nextAssignments, nextMembers, nextRequests] = await Promise.all([
        fetchCourse(courseId),
        fetchCourseAssignments(courseId),
        fetchCourseMembers(courseId),
        fetchPendingRequests(courseId),
      ])
      setCourse(nextCourse)
      setAssignments(nextAssignments)
      setMembers(nextMembers)
      setRequests(nextRequests)
      setError(null)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [courseId])

  if (loading) return <LoadingBlock label="Loading course…" />
  if (error) return <Notice tone="error">{error}</Notice>
  if (!course) return <EmptyState title="Course not found" />

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={course.course_code} title={course.name}>
        <Link className="btn btn-primary" to={`/teacher/courses/${course.id}/assignments/new`}>New assignment</Link>
      </PageHeader>
      {message ? <Notice tone="success">{message}</Notice> : null}
      <CourseEditor course={course} onSaved={(text) => { setMessage(text); void load() }} />
      <section className="grid gap-4 lg:grid-cols-2">
        <form className="panel space-y-3 p-5" onSubmit={onSubmit(async () => {
          setMessage(null)
          try {
            await enrollByStudentId(course.id, studentId)
            setStudentId('')
            setMessage('Student enrolled.')
            await load()
          } catch (reason) {
            setError(errorMessage(reason))
          }
        })}>
          <h2 className="font-serif text-2xl">Enroll a student</h2>
          <TextField id="student-id" label="Student ID" required value={studentId} onChange={(event) => setStudentId(event.target.value)} hint="The student sets this on their profile." />
          <button className="btn btn-pine" type="submit">Enroll</button>
        </form>
        <form className="panel space-y-3 p-5" onSubmit={onSubmit(async () => {
          setMessage(null)
          try {
            await addCourseTeacher(course.id, teacherEmail)
            setTeacherEmail('')
            setMessage('Teacher added. They must already have the teacher or admin role.')
            await load()
          } catch (reason) {
            setError(errorMessage(reason))
          }
        })}>
          <h2 className="font-serif text-2xl">Add a teacher</h2>
          <TextField id="teacher-email" label="Teacher email" type="email" required value={teacherEmail} onChange={(event) => setTeacherEmail(event.target.value)} />
          <button className="btn btn-quiet" type="submit">Add teacher</button>
        </form>
      </section>
      <section className="panel p-5">
        <h2 className="font-serif text-2xl">Enrollment requests</h2>
        {requests.length === 0 ? <p className="mt-2 text-sm text-muted">No pending requests.</p> : null}
        <ul className="mt-3 space-y-3">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>{request.display_name} · {request.student_code ?? 'No student ID'}</span>
              <span className="flex gap-2">
                <button type="button" className="btn btn-pine" onClick={() => void decide(request.id, true)}>Approve</button>
                <button type="button" className="btn btn-quiet" onClick={() => void decide(request.id, false)}>Reject</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel p-5">
        <h2 className="font-serif text-2xl">People</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {members.map((member) => (
            <li key={member.user_id}>{member.display_name} · {member.membership_role} · {member.student_id ?? 'No student ID'}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 font-serif text-3xl">Assignments</h2>
        {assignments.length === 0 ? <EmptyState title="No assignments yet" /> : null}
        <div className="grid gap-3">
          {assignments.map((assignment) => (
            <article key={assignment.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-2xl">{assignment.title}</h3>
                  <StatusBadge value={assignment.status} />
                </div>
                <p className="text-sm text-muted">{new Date(assignment.due_at).toISOString()}</p>
              </div>
              <div className="flex gap-2">
                <Link className="btn btn-quiet" to={`/teacher/assignments/${assignment.id}/edit`}>Edit</Link>
                <Link className="btn btn-pine" to={`/teacher/assignments/${assignment.id}/review`}>Review</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )

  async function decide(requestId: string, approve: boolean) {
    setMessage(null)
    try {
      await decideEnrollment(requestId, approve)
      setMessage(approve ? 'Student enrolled.' : 'Request rejected.')
      await load()
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }
}

function CourseEditor({ course, onSaved }: { course: Course; onSaved: (message: string) => void }) {
  const [name, setName] = useState(course.name)
  const [courseCode, setCourseCode] = useState(course.course_code)
  const [description, setDescription] = useState(course.description ?? '')
  const [timezone, setTimezone] = useState(course.timezone)
  const [archived, setArchived] = useState(Boolean(course.archived_at))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setName(course.name)
    setCourseCode(course.course_code)
    setDescription(course.description ?? '')
    setTimezone(course.timezone)
    setArchived(Boolean(course.archived_at))
  }, [course])

  return (
    <form className="panel space-y-4 p-5" onSubmit={onSubmit(async () => {
      setBusy(true)
      setError(null)
      try {
        await updateCourse(course.id, { name, courseCode, description, timezone, archived })
        onSaved('Course saved.')
      } catch (reason) {
        setError(errorMessage(reason))
      } finally {
        setBusy(false)
      }
    })}>
      <h2 className="font-serif text-2xl">Course settings</h2>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <TextField id="course-name" label="Name" required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
      <TextField id="course-code-edit" label="Course code" required value={courseCode} onChange={(event) => setCourseCode(event.target.value)} />
      <TextAreaField id="course-description" label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
      <label className="block text-sm font-semibold" htmlFor="course-zone">
        Time zone
        <select id="course-zone" className="field mt-1 font-normal" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          {timeZoneOptions().map((zone) => <option key={zone} value={zone}>{zone}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="archive-course">
        <input id="archive-course" type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
        Archive this course
      </label>
      <button className="btn btn-quiet" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save course'}</button>
    </form>
  )
}
