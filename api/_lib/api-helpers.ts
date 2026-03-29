import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken, type JwtPayload } from './auth.js'

/**
 * Set CORS headers on every response.
 * Call at the top of every handler.
 */
export const setCors = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
}

/**
 * Handle CORS preflight. Returns true if the request was an OPTIONS preflight
 * (and has been responded to), false otherwise.
 */
export const handleCors = (req: VercelRequest, res: VercelResponse): boolean => {
  setCors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

export const json = (res: VercelResponse, data: unknown, status = 200) => {
  return res.status(status).json(data)
}

export const error = (res: VercelResponse, message: string, status = 400) => {
  return res.status(status).json({ error: message })
}

export const methodNotAllowed = (res: VercelResponse) => {
  return error(res, 'Method not allowed', 405)
}

/**
 * Require authentication. Returns the decoded JWT payload or sends 401 and returns null.
 */
export const requireAuth = (req: VercelRequest, res: VercelResponse): JwtPayload | null => {
  try {
    return verifyToken(req)
  } catch {
    error(res, 'Unauthorized', 401)
    return null
  }
}
