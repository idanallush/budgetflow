import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, isNull, and } from 'drizzle-orm'
import { getDb } from '../../_lib/db'
import { budgetPeriods, changelog } from '../../_lib/schema'
import { json, error, methodNotAllowed, requireAuth } from '../../_lib/api-helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res)

  const user = requireAuth(req, res)
  if (!user) return

  const campaignId = req.query.id as string
  if (!campaignId) return error(res, 'Campaign ID is required')

  const { new_budget, effective_date, old_budget } = req.body ?? {}
  if (!new_budget || !effective_date || old_budget === undefined) {
    return error(res, 'new_budget, effective_date, and old_budget are required')
  }

  try {
    const db = getDb()

    // Close the current open budget period
    const endDate = new Date(effective_date)
    endDate.setDate(endDate.getDate() - 1)
    const endDateStr = endDate.toISOString().split('T')[0]

    await db
      .update(budgetPeriods)
      .set({ end_date: endDateStr })
      .where(
        and(
          eq(budgetPeriods.campaign_id, campaignId),
          isNull(budgetPeriods.end_date)
        )
      )

    // Create new budget period
    const [newPeriod] = await db
      .insert(budgetPeriods)
      .values({
        campaign_id: campaignId,
        daily_budget: String(new_budget),
        start_date: effective_date,
      })
      .returning()

    // Changelog entry
    await db.insert(changelog).values({
      campaign_id: campaignId,
      action: 'budget_change',
      description: `תקציב שונה מ-₪${old_budget} ל-₪${new_budget}, החל מ-${effective_date}`,
      old_value: String(old_budget),
      new_value: String(new_budget),
      performed_by: user.name,
    })

    return json(res, newPeriod, 201)
  } catch (err) {
    console.error('Budget change error:', err)
    return error(res, 'Internal server error', 500)
  }
}
