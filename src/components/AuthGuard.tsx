import { type ReactNode } from 'react'

interface AuthGuardProps {
  children: ReactNode
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  // TODO: Re-enable auth when ready for production
  // const token = getToken()
  // if (!token) {
  //   return <Navigate to="/login" replace />
  // }
  return <>{children}</>
}
