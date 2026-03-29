import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, isNull, and } from 'drizzle-orm'
import { getDb } from '../../_lib/db'
import { campaigns, budgetPeriods, changelog } from '../../_lib/schema'
import { json, error, methodNotAllowed, requireAuth } from '../../_lib/api-helpers'

const statusLabels: Record<string, string> = {
  active: 'פעיל',
  paused: 'מושהה',
  stopped: 'הופסק',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res)

  const user = requireAuth(req, res)
  if (!user) return

  const campaignId = req.query.id as string
  if (!campaignId) return error(res, 'Campaign ID is required')

  const { status, end_date } = req.body ?? {}
  if (!status) return error(res, 'status is required')

  try {
    const db = getDb()

    const updateData: Record<string, unknown> = { status }
    if (end_date) updateData.end_date = end_date

    const [updated] = await db
      .update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, campaignId))
      .returning()

    if (!updated) return error(res, 'Campaign not found', 404)

    // If stopped, close open budget period
    if (status === 'stopped' && end_date) {
      await db
        .update(budgetPeriods)
        .set({ end_date })
        .where(
          and(
            eq(budgetPeriods.campaign_id, campaignId),
            isNull(budgetPeriods.end_date)
          )
        )
    }

    // Changelog entry
    await db.insert(changelog).values({
      campaign_id: campaignId,
      action: 'status_change',
      description: `סטטוס שונה ל${statusLabels[status] ?? status}`,
      new_value: status,
      performed_by: user.name,
    })

    return json(res, updated)
  } catch (err) {
    console.error('Status change error:', err)
    return error(res, 'Internal server error', 500)
  }
}
