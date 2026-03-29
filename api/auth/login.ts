import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb } from '../../src/lib/db'
import { teamMembers } from '../../src/lib/schema'
import { signToken } from '../../src/lib/auth'
import { json, error, methodNotAllowed } from '../../src/lib/api-helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res)

  const { email, password } = req.body ?? {}
  if (!email || !password) return error(res, 'Email and password are required')

  try {
    const db = getDb()
    const [user] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.email, email))
      .limit(1)

    if (!user || !user.is_active) {
      return error(res, 'Invalid email or password', 401)
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return error(res, 'Invalid email or password', 401)
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    })

    return json(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    return error(res, 'Internal server error', 500)
  }
}
