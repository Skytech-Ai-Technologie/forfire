import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ember">404</p>
      <h1 className="mt-2 font-serif text-4xl">That page is not in ForFire.</h1>
      <p className="mt-3 text-muted">The address may be mistyped. The rest of the site is still here.</p>
      <Link className="btn btn-primary mt-6" to="/">Back to the start</Link>
    </div>
  )
}
