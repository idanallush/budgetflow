import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, isNull, and } from 'drizzle-orm'
import { getDb } from '../_lib/db.js'
import { campaigns, budgetPeriods, changelog } from '../_lib/schema.js'
import { json, error, methodNotAllowed, requireAuth, handleCors } from '../_lib/api-helpers.js'

const statusLabels: Record<string, string> = {
  active: 'פעיל',
  paused: 'מושהה',
  stopped: 'הופסק',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return
  const user = requireAuth(req, res)
  if (!user) return

  const id = req.query.id as string
  if (!id) return error(res, 'Campaign ID is required')

  const db = getDb()

  // GET — get campaign by ID
  if (req.method === 'GET') {
    try {
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1)
      if (!campaign) return error(res, 'Campaign not found', 404)
      return json(res, campaign)
    } catch (err) {
      console.error('Get campaign error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  // PUT — update campaign details OR change budget OR change status
  if (req.method === 'PUT') {
    const body = req.body ?? {}

    // Budget change: { action: 'budget', new_budget, effective_date, old_budget }
    if (body.action === 'budget') {
      const { new_budget, effective_date, old_budget } = body
      if (!new_budget || !effective_date || old_budget === undefined) {
        return error(res, 'new_budget, effective_date, and old_budget are required')
      }
      try {
        const endDate = new Date(effective_date)
        endDate.setDate(endDate.getDate() - 1)
        const endDateStr = endDate.toISOString().split('T')[0]

        await db.update(budgetPeriods).set({ end_date: endDateStr }).where(
          and(eq(budgetPeriods.campaign_id, id), isNull(budgetPeriods.end_date))
        )

        const [newPeriod] = await db.insert(budgetPeriods).values({
          campaign_id: id,
          daily_budget: String(new_budget),
          start_date: effective_date,
        }).returning()

        await db.insert(changelog).values({
          campaign_id: id,
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

    // Status change: { action: 'status', status, end_date? }
    if (body.action === 'status') {
      const { status, end_date } = body
      if (!status) return error(res, 'status is required')
      try {
        const updateData: Record<string, unknown> = { status }
        if (end_date) updateData.end_date = end_date

        const [updated] = await db.update(campaigns).set(updateData).where(eq(campaigns.id, id)).returning()
        if (!updated) return error(res, 'Campaign not found', 404)

        if (status === 'stopped' && end_date) {
          await db.update(budgetPeriods).set({ end_date }).where(
            and(eq(budgetPeriods.campaign_id, id), isNull(budgetPeriods.end_date))
          )
        }

        await db.insert(changelog).values({
          campaign_id: id,
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

    // General update (campaign details)
    try {
      const [updated] = await db.update(campaigns).set(body).where(eq(campaigns.id, id)).returning()
      if (!updated) return error(res, 'Campaign not found', 404)
      return json(res, updated)
    } catch (err) {
      console.error('Update campaign error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  // DELETE
  if (req.method === 'DELETE') {
    try {
      const [deleted] = await db.delete(campaigns).where(eq(campaigns.id, id)).returning()
      if (!deleted) return error(res, 'Campaign not found', 404)
      return json(res, { success: true })
    } catch (err) {
      console.error('Delete campaign error:', err)
      return error(res, 'Internal server error', 500)
    }
  }

  return methodNotAllowed(res)
}
