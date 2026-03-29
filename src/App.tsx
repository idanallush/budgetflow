import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { AuthGuard } from '@/components/AuthGuard'
import { Dashboard } from '@/pages/Dashboard'
import { ClientView } from '@/pages/ClientView'
import { ShareView } from '@/pages/ShareView'
import { Login } from '@/pages/Login'
import { ToastContainer } from '@/components/ui/Toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
})

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
