import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { clients } from '../lib/schema'
import { json, error, methodNotAllowed, requireAuth } from '../lib/api-helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  const slug = req.query.slug as string
  if (!slug) return error(res, 'Slug is required')

  const db = getDb()

  if (req.method === 'GET') {
    try {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.slug, slug))
        .limit(1)

      if (!client) return error(res, 'Client not found', 404)
      return json(res, client)
    } catch (err) {
      console.error('Get client error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  if (req.method === 'PUT') {
    const updates = req.body ?? {}

    try {
      const [updated] = await db
        .update(clients)
        .set(updates)
        .where(eq(clients.slug, slug))
        .returning()

      if (!updated) return error(res, 'Client not found', 404)
      return json(res, updated)
    } catch (err) {
      console.error('Update client error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  return methodNotAllowed(res)
}
