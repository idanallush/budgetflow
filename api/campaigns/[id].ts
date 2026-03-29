import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb } from '../_lib/db.js'
import { campaigns } from '../_lib/schema.js'
import { json, error, methodNotAllowed, requireAuth, handleCors } from '../_lib/api-helpers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return
  const user = requireAuth(req, res)
  if (!user) return

  const id = req.query.id as string
  if (!id) return error(res, 'Campaign ID is required')

  const db = getDb()

  if (req.method === 'GET') {
    try {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, id))
        .limit(1)

      if (!campaign) return error(res, 'Campaign not found', 404)
      return json(res, campaign)
    } catch (err) {
      console.error('Get campaign error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  if (req.method === 'PUT') {
    const updates = req.body ?? {}
    try {
      const [updated] = await db
        .update(campaigns)
        .set(updates)
        .where(eq(campaigns.id, id))
        .returning()

      if (!updated) return error(res, 'Campaign not found', 404)
      return json(res, updated)
    } catch (err) {
      console.error('Update campaign error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  return methodNotAllowed(res)
}
