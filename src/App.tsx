import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { AuthGuard } from '@/components/AuthGuard'
import { Dashboard } from '@/pages/Dashboard'
import { ClientView } from '@/pages/ClientView'
import { ShareView } from '@/pages/ShareView'
import { Login } from '@/pages/Login'
import { ToastContainer, toast } from '@/components/ui/Toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message === 'AUTH_EXPIRED') return false
        return failureCount < 1
      },
    },
  },
})

const AuthExpiredHandler = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => {
      toast.error('החיבור פג תוקף — יש להתחבר מחדש')
      queryClient.clear()
      navigate('/login', { replace: true })
    }
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [navigate])

  return null
}

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthExpiredHandler />
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/share/:token" element={<ShareView />} />
            <Route
              path="/"
              element={
                <AuthGuard>
                  <Dashboard />
                </AuthGuard>
              }
            />
            <Route
              path="/clients/:slug"
              element={
                <AuthGuard>
                  <ClientView />
                </AuthGuard>
              }
            />
          </Routes>
        </Layout>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
