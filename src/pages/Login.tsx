import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

export const Login = () => {
  const navigate = useNavigate()
  const { login, loginError, isLoggingIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    try {
      await login({ email, password })
      navigate('/')
    } catch {
      // Error is handled by loginError
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassPanel className="w-full max-w-sm p-8 animate-enter">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mb-4">
            <span className="text-white text-xl font-semibold">B</span>
          </div>
          <h1 className="text-2xl font-semibold leading-tight">BudgetFlow</h1>
          <p className="text-sm text-text-secondary mt-2">כניסה למערכת</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="אימייל"
            type="email"
            placeholder="idan@bright.co.il"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <Input
            label="סיסמה"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {loginError && (
            <p className="text-sm text-danger text-center">
              {loginError.message === 'Invalid email or password'
                ? 'אימייל או סיסמה שגויים'
                : loginError.message === 'NETWORK_ERROR'
                ? 'שגיאת רשת — בדוק חיבור לאינטרנט'
                : loginError.message === 'INVALID_RESPONSE'
                ? 'שגיאת שרת — תשובה לא תקינה'
                : `שגיאה: ${loginError.message}`}
            </p>
          )}

          <Button
            type="submit"
            className="w-full justify-center mt-2"
            disabled={!email || !password || isLoggingIn}
          >
            <LogIn size={18} />
            {isLoggingIn ? 'מתחבר...' : 'כניסה'}
          </Button>
        </form>

        <p className="text-xs text-text-muted text-center mt-6">
          Bright Agency — ניהול תקציבים
        </p>
      </GlassPanel>
    </div>
  )
}
