import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken, type JwtPayload } from './auth.js'

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
