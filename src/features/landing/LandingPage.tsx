import { Link } from 'react-router-dom'
import { publicPreview } from '../../lib/preview.ts'
import { supabaseConfigMessage } from '../../lib/supabase.ts'
import { Notice, TextLink } from '../../components/ui.tsx'

export function LandingPage() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ember">For university classes</p>
        <h1 className="mt-3 max-w-xl font-serif text-5xl leading-[1.05] sm:text-6xl">
          Homework with a clear deadline and a private hand-in.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          {publicPreview
            ? 'Open the sample class in your browser. There is no sign-up and no database on this public copy.'
            : 'Students see the work for courses they are enrolled in, upload a file, and read feedback meant only for them. Teachers publish assignments and review those submissions.'}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {publicPreview ? (
            <>
              <Link className="btn btn-primary" to="/student">
                Student view
              </Link>
              <Link className="btn btn-quiet" to="/teacher">
                Teacher view
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-primary" to="/sign-in">
                Sign in
              </Link>
              <Link className="btn btn-quiet" to="/sign-up">
                Create a student account
              </Link>
            </>
          )}
        </div>
        {!publicPreview && supabaseConfigMessage ? (
          <div className="mt-6 max-w-xl">
            <Notice tone="info">{supabaseConfigMessage}</Notice>
          </div>
        ) : null}
      </section>
      <section className="panel p-6">
        <h2 className="font-serif text-3xl">How a class uses it</h2>
        <ol className="mt-4 space-y-4 text-sm leading-6">
          <li>
            <strong>1. An administrator appoints a teacher.</strong> A new account is a student. Nobody can promote themselves.
          </li>
          <li>
            <strong>2. The teacher opens a course</strong> and enrolls students, or students request a seat with the course code.
          </li>
          <li>
            <strong>3. Assignments carry a deadline, file rules, and a time zone.</strong> Late work is judged from the server clock.
          </li>
          <li>
            <strong>4. Files stay private.</strong> A student can download their own work. A teacher can download work for their course.
          </li>
        </ol>
        <p className="mt-6 text-sm">
          {publicPreview ? (
            'The sample course is CS101. Student and teacher pages use the same made-up class.'
          ) : (
            <>
              Already registered? <TextLink to="/sign-in">Sign in</TextLink> or <TextLink to="/reset-password">reset your password</TextLink>.
            </>
          )}
        </p>
      </section>
    </div>
  )
}
