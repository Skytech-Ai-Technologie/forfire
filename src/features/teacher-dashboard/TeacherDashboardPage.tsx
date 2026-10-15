import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/auth-context.ts'
import { EmptyState, LoadingBlock, Notice, PageHeader, StatusBadge } from '../../components/ui.tsx'
import { fetchCourses, fetchProfilesForAdmin, promoteUser } from '../../lib/api.ts'
import { errorMessage } from '../../lib/supabase.ts'
import type { Course, Profile, UserRole } from '../../types/database.ts'

export function TeacherDashboardPage() {
  const { profile } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchCourses()
      .then((next) => {
        if (active) setCourses(next)
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
  }, [])

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Teacher" title="Courses">
        <Link className="btn btn-primary" to="/teacher/courses/new">New course</Link>
      </PageHeader>
      {loading ? <LoadingBlock /> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!loading && courses.length === 0 ? (
        <EmptyState title="No courses yet">Create a course, then publish an assignment.</EmptyState>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {courses.map((course) => (
          <article key={course.id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-pine">{course.course_code}</p>
                <h2 className="font-serif text-2xl">{course.name}</h2>
              </div>
              {course.archived_at ? <StatusBadge value="archived" /> : <StatusBadge value="published" />}
            </div>
            <p className="mt-2 text-sm text-muted">{course.timezone}</p>
            <Link className="btn btn-quiet mt-4" to={`/teacher/courses/${course.id}`}>Open course</Link>
          </article>
        ))}
      </div>
      {profile?.role === 'admin' ? <AdminPanel /> : null}
    </div>
  )
}

function AdminPanel() {
  const { profile, refreshProfile } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchProfilesForAdmin()
      .then((next) => {
        if (active) setPeople(next)
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason))
      })
    return () => {
      active = false
    }
  }, [])

  async function changeRole(person: Profile, role: UserRole) {
    setError(null)
    setMessage(null)
    try {
      await promoteUser(person.id, role)
      setPeople(await fetchProfilesForAdmin())
      if (person.id === profile?.id) await refreshProfile()
      setMessage(`${person.display_name} is now ${role}.`)
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  return (
    <section className="panel p-5">
      <h2 className="font-serif text-3xl">Appoint teachers</h2>
      <p className="mt-2 text-sm text-muted">Only an existing admin can change roles. The first admin is created in the Supabase SQL editor, not here.</p>
      {message ? <div className="mt-3"><Notice tone="success">{message}</Notice></div> : null}
      {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
      <ul className="mt-4 divide-y divide-line">
        {people.map((person) => (
          <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-semibold">{person.display_name}</p>
              <p className="text-muted">{person.student_id ?? 'No student ID'} · {person.role}</p>
            </div>
            <label className="text-xs font-semibold" htmlFor={`role-${person.id}`}>
              Role
              <select
                id={`role-${person.id}`}
                className="field ml-2 font-normal"
                value={person.role}
                disabled={person.id === profile?.id}
                onChange={(event) => void changeRole(person, event.target.value as UserRole)}
              >
                <option value="student">student</option>
                <option value="teacher">teacher</option>
                <option value="admin">admin</option>
              </select>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
