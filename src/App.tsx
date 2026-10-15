import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './app/AuthProvider.tsx'
import { Layout } from './components/Layout.tsx'
import { AppRoutes } from './routes/AppRoutes.tsx'

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Layout>
          <AppRoutes />
        </Layout>
      </AuthProvider>
    </HashRouter>
  )
}
