import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { getToken } from '@/hooks/useAuth'

interface AuthGuardProps {
  children: ReactNode
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const token = getToken()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
