import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, asc } from 'drizzle-orm'
import { getDb } from '../lib/db'
import { campaigns, budgetPeriods, changelog } from '../lib/schema'
import { json, error, methodNotAllowed, requireAuth } from '../lib/api-helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  const db = getDb()

  if (req.method === 'GET') {
    const clientId = req.query.client_id as string
    if (!clientId) return error(res, 'client_id is required')

    try {
      const campaignList = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.client_id, clientId))
        .orderBy(campaigns.platform, campaigns.name)

      const campaignIds = campaignList.map((c) => c.id)

      let periods: (typeof budgetPeriods.$inferSelect)[] = []
      if (campaignIds.length > 0) {
        // Fetch all budget periods for these campaigns
        const allPeriods = await db
          .select()
          .from(budgetPeriods)
          .orderBy(asc(budgetPeriods.start_date))

        periods = allPeriods.filter((p) => campaignIds.includes(p.campaign_id))
      }

      return json(res, { campaigns: campaignList, budget_periods: periods })
    } catch (err) {
      console.error('Get campaigns error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  if (req.method === 'POST') {
    const { client_id, name, technical_name, platform, campaign_type, daily_budget, start_date, ad_link, notes } = req.body ?? {}
    if (!client_id || !name || !platform || !daily_budget || !start_date) {
      return error(res, 'client_id, name, platform, daily_budget, and start_date are required')
    }

    try {
      const [newCampaign] = await db
        .insert(campaigns)
        .values({
          client_id,
          name,
          technical_name: technical_name ?? null,
          platform,
          campaign_type: campaign_type ?? null,
          ad_link: ad_link ?? null,
          start_date,
          notes: notes ?? null,
        })
        .returning()

      // Create initial budget period
      await db.insert(budgetPeriods).values({
        campaign_id: newCampaign.id,
        daily_budget: String(daily_budget),
        start_date,
      })

      // Changelog entry
      await db.insert(changelog).values({
        campaign_id: newCampaign.id,
        action: 'campaign_added',
        description: `קמפיין חדש נוסף: ${name}`,
        performed_by: user.name,
      })

      return json(res, newCampaign, 201)
    } catch (err) {
      console.error('Create campaign error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  return methodNotAllowed(res)
}
