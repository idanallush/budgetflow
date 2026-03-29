import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, asc } from 'drizzle-orm'
import { getDb } from '../_lib/db.js'
import { clients, campaigns, budgetPeriods } from '../_lib/schema.js'
import { json, error, methodNotAllowed } from '../_lib/api-helpers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res)

  const token = req.query.token as string
  if (!token) return error(res, 'Token is required')

  try {
    const db = getDb()

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.share_token, token))
      .limit(1)

    if (!client) return error(res, 'Invalid share link', 404)

    const campaignList = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.client_id, client.id))
      .orderBy(campaigns.platform, campaigns.name)

    const campaignIds = campaignList.map((c) => c.id)
    let periods: (typeof budgetPeriods.$inferSelect)[] = []

    if (campaignIds.length > 0) {
      const allPeriods = await db
        .select()
        .from(budgetPeriods)
        .orderBy(asc(budgetPeriods.start_date))

      periods = allPeriods.filter((p) => campaignIds.includes(p.campaign_id))
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
