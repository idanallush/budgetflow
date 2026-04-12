import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, asc, inArray, and } from 'drizzle-orm'
import { getDb } from '../_lib/db.js'
import { clients, campaigns, budgetPeriods } from '../_lib/schema.js'
import { json, error, handleCors } from '../_lib/api-helpers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return

  const token = req.query.token as string
  if (!token) return error(res, 'Token is required')

  const db = getDb()

  // Validate share token exists
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.share_token, token))
    .limit(1)

  if (!client) return error(res, 'Invalid share link', 404)

  // GET — read share data
  if (req.method === 'GET') {
    try {
      const campaignList = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.client_id, client.id))
        .orderBy(campaigns.platform, campaigns.name)

      const campaignIds = campaignList.map((c) => c.id)
      let periods: (typeof budgetPeriods.$inferSelect)[] = []

      if (campaignIds.length > 0) {
        periods = await db
          .select()
          .from(budgetPeriods)
          .where(inArray(budgetPeriods.campaign_id, campaignIds))
          .orderBy(asc(budgetPeriods.start_date))
      }

      return json(res, {
        client,
        campaigns: campaignList,
        budget_periods: periods,
      })
    } catch (err) {
      console.error('Share view error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  // PUT — update campaign notes (client-facing, no auth, validated by share token)
  if (req.method === 'PUT') {
    const { campaign_id, notes } = req.body ?? {}
    if (!campaign_id) return error(res, 'campaign_id is required')

    try {
      // Verify the campaign belongs to this client
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, campaign_id), eq(campaigns.client_id, client.id)))
        .limit(1)

      if (!campaign) return error(res, 'Campaign not found', 404)

      const [updated] = await db
        .update(campaigns)
        .set({ notes: notes || null })
        .where(eq(campaigns.id, campaign_id))
        .returning()

      return json(res, updated)
    } catch (err) {
      console.error('Share notes update error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  return error(res, 'Method not allowed', 405)
}
