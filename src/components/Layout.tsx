import { type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface LayoutProps {
  children: ReactNode
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()
  const isShareView = location.pathname.startsWith('/share/')
  const isLoginPage = location.pathname === '/login'

  if (isShareView || isLoginPage) {
    return <>{children}</>
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col p-4 gap-4">
      <header className="flex items-center justify-between max-w-6xl mx-auto w-full px-4 py-3 glass-panel">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white text-sm font-semibold">B</span>
          </div>
          <span className="text-lg font-semibold">BudgetFlow</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/"
            className={`btn-ghost !rounded-[10px] !px-3 !py-2 text-sm ${
              location.pathname === '/' ? '!bg-card-bg-active !border-glass-border-active' : ''
            }`}
          >
            <LayoutDashboard size={16} />
            <span>דשבורד</span>
          </Link>
          {isAuthenticated && (
            <>
              {user && (
                <span className="text-xs text-text-muted hidden sm:inline">
                  {user.name}
                </span>
              )}
              <button className="btn-icon" onClick={handleLogout} title="התנתק">
                <LogOut size={16} />
              </button>
            </>
          )}
        </nav>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full">
        {children}
      </main>

      <footer className="text-center text-xs py-2" style={{ color: 'var(--color-text-muted)' }}>
        BudgetFlow — Bright Agency &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
