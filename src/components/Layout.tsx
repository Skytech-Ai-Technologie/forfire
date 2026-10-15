import { useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/auth-context.ts'
import { publicPreview } from '../lib/preview.ts'
import { isStaffRole } from '../lib/permissions.ts'
import { Notice } from './ui.tsx'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-2 text-sm font-semibold ${isActive ? 'bg-pine text-white' : 'text-ink hover:bg-white'}`

export function Layout({ children }: { children: ReactNode }) {
  const { session, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const staff = isStaffRole(profile?.role)

  async function onSignOut() {
    await signOut()
    setOpen(false)
    navigate('/')
  }

  const links = publicPreview
    ? [
        { to: '/student', label: 'Student' },
        { to: '/teacher', label: 'Teacher' },
      ]
    : !session
    ? [{ to: '/sign-in', label: 'Sign in' }]
    : staff
      ? [
          { to: '/teacher', label: 'Dashboard' },
          { to: '/teacher/courses/new', label: 'New course' },
          { to: '/profile', label: 'Profile' },
        ]
      : [
          { to: '/student', label: 'Dashboard' },
          { to: '/student/submissions', label: 'My submissions' },
          { to: '/profile', label: 'Profile' },
        ]

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fffaf2,_#f3eee4_42%,_#efe6d6)] text-ink">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="border-b border-line/80 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-10 w-10" />
            <span>
              <span className="block font-serif text-2xl leading-none">ForFire</span>
              <span className="text-xs uppercase tracking-[0.16em] text-muted">University coursework</span>
            </span>
          </Link>
          <button
            type="button"
            className="btn btn-quiet md:hidden"
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
          <nav id="site-nav" className={`${open ? 'block' : 'hidden'} absolute left-0 right-0 top-[4.6rem] z-20 border-b border-line bg-paper px-4 py-3 md:static md:block md:border-0 md:bg-transparent md:p-0`}>
            <ul className="flex flex-col gap-2 md:flex-row md:items-center">
              {links.map((link) => (
                <li key={link.to}>
                  <NavLink to={link.to} className={linkClass} onClick={() => setOpen(false)}>
                    {link.label}
                  </NavLink>
                </li>
              ))}
              {session && !publicPreview ? (
                <li>
                  <button type="button" className="btn btn-quiet w-full md:w-auto" onClick={() => void onSignOut()}>
                    Sign out
                  </button>
                </li>
              ) : null}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8">
        {publicPreview ? (
          <div className="mb-6">
            <Notice tone="info">
              This is a public website. You can open the student and teacher pages without an account. Nothing you type is saved.
            </Notice>
          </div>
        ) : null}
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-sm text-muted">
        {publicPreview
          ? 'Public preview. Accounts and file storage are turned off on this copy.'
          : 'Submitted files stay in private storage. They are not saved in the website source repository.'}
      </footer>
    </div>
  )
}
