import jwt from 'jsonwebtoken'
import type { VercelRequest } from '@vercel/node'

const JWT_SECRET = process.env.JWT_SECRET || 'budgetflow-dev-secret-change-me'

export interface JwtPayload {
  userId: string
  email: string
  role: string
  name: string
}

export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export const verifyToken = (req: VercelRequest): JwtPayload => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const token = authHeader.slice(7)
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    throw new Error('Invalid or expired token')
  }
}
