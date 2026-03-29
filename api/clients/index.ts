import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { clients } from '../lib/schema'
import { json, error, methodNotAllowed, requireAuth } from '../lib/api-helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  const db = getDb()

  if (req.method === 'GET') {
    try {
      const result = await db
        .select()
        .from(clients)
        .where(eq(clients.is_active, true))
        .orderBy(clients.name)

      return json(res, result)
    } catch (err) {
      console.error('Get clients error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  if (req.method === 'POST') {
    const { name, slug, share_token, notes } = req.body ?? {}
    if (!name || !slug || !share_token) {
      return error(res, 'Name, slug, and share_token are required')
    }

    try {
      const [newClient] = await db
        .insert(clients)
        .values({ name, slug, share_token, notes: notes ?? null })
        .returning()

      return json(res, newClient, 201)
    } catch (err) {
      console.error('Create client error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  return methodNotAllowed(res)
}
