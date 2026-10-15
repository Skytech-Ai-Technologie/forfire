import { useEffect, useState } from 'react'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './app/AuthProvider.tsx'
import { Layout } from './components/Layout.tsx'
import { AppRoutes } from './routes/AppRoutes.tsx'

const logoUrl = `${import.meta.env.BASE_URL}fire-removebg-preview.png`

function BootLoader() {
  return (
    <div className="boot-loader" role="status" aria-label="Chargement de ForFire-AI">
      <img
        src={logoUrl}
        alt="ForFire-AI"
        className="boot-logo"
        onError={(event) => {
          const target = event.currentTarget
          if (!target.src.endsWith('favicon.svg')) target.src = `${import.meta.env.BASE_URL}favicon.svg`
        }}
      />
      <p className="boot-text">ForFire-AI Challenge</p>
    </div>
  )
}

export default function App() {
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 900)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <HashRouter>
      <AuthProvider>
        {booting ? <BootLoader /> : null}
        <Layout>
          <AppRoutes />
        </Layout>
      </AuthProvider>
    </HashRouter>
  )
}
