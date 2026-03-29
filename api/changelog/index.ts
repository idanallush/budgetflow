import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, desc, inArray } from 'drizzle-orm'
import { getDb } from '../_lib/db.js'
import { changelog, campaigns } from '../_lib/schema.js'
import { json, error, methodNotAllowed, requireAuth, handleCors } from '../_lib/api-helpers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') return methodNotAllowed(res)

  const user = requireAuth(req, res)
  if (!user) return

  const campaignId = req.query.campaign_id as string | undefined
  const clientId = req.query.client_id as string | undefined

  if (!campaignId && !clientId) {
    return error(res, 'campaign_id or client_id is required')
  }

  try {
    const db = getDb()

    if (campaignId) {
      const entries = await db
        .select()
        .from(changelog)
        .where(eq(changelog.campaign_id, campaignId))
        .orderBy(desc(changelog.performed_at))

      return json(res, entries)
    }

    // By client_id: get all campaigns for the client, then their changelogs
    const clientCampaigns = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.client_id, clientId!))

    const campaignIds = clientCampaigns.map((c) => c.id)
    if (campaignIds.length === 0) return json(res, [])

    const entries = await db
      .select()
      .from(changelog)
      .where(inArray(changelog.campaign_id, campaignIds))
      .orderBy(desc(changelog.performed_at))

    return json(res, entries)
  } catch (err) {
    console.error('Get changelog error:', err)
    return error(res, 'Internal server error', 500)
  }
}
