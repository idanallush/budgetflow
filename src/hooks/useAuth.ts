import { useState, useCallback, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'

const TOKEN_KEY = 'budgetflow_token'
const USER_KEY = 'budgetflow_user'

interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY)
}

export const getAuthHeaders = (): Record<string, string> => {
  const token = getToken()
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

export const getStoredUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser)
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken())

  useEffect(() => {
    setIsAuthenticated(!!getToken())
    setUser(getStoredUser())
  }, [])

  const loginMutation = useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      console.log('[useAuth] Sending login request:', { email: input.email })

      let res: Response
      try {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
      } catch (networkErr) {
        console.error('[useAuth] Network error:', networkErr)
        throw new Error('NETWORK_ERROR')
      }

      console.log('[useAuth] Response status:', res.status, res.statusText)

      const text = await res.text()
      console.log('[useAuth] Response body:', text.slice(0, 500))

      let data: { token?: string; user?: AuthUser; error?: string }
      try {
        data = JSON.parse(text)
      } catch {
        console.error('[useAuth] Response is not JSON:', text.slice(0, 200))
        throw new Error('INVALID_RESPONSE')
      }

      if (!res.ok) {
        console.error('[useAuth] Login failed:', data.error)
        throw new Error(data.error || 'LOGIN_FAILED')
      }

      if (!data.token || !data.user) {
        console.error('[useAuth] Missing token or user in response:', data)
        throw new Error('INVALID_RESPONSE')
      }

      console.log('[useAuth] Login success, user:', data.user.name)
      return data as { token: string; user: AuthUser }
    },
    onSuccess: (data) => {
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      setUser(data.user)
      setIsAuthenticated(true)
      console.log('[useAuth] Token saved to localStorage')
    },
  })

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
    setIsAuthenticated(false)
  }, [])

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    logout,
  }
}
