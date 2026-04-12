import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, inArray, isNull, and } from 'drizzle-orm'
import { getDb } from '../_lib/db.js'
import { campaigns, budgetPeriods, changelog } from '../_lib/schema.js'
import { json, error, methodNotAllowed, requireAuth, handleCors } from '../_lib/api-helpers.js'

const statusLabels: Record<string, string> = {
  active: 'פעיל',
  paused: 'מושהה',
  stopped: 'הופסק',
  scheduled: 'מתוזמן',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return
  const user = requireAuth(req, res)
  if (!user) return

  if (req.method !== 'PUT') return methodNotAllowed(res)

  const body = req.body ?? {}
  const { ids, action } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return error(res, 'ids array is required and must not be empty')
  }
  if (!action) return error(res, 'action is required')

  const db = getDb()

  try {
    // Bulk status change
    if (action === 'status') {
      const { status, end_date } = body
      if (!status) return error(res, 'status is required')

      const updateData: Record<string, unknown> = { status }
      if (end_date) updateData.end_date = end_date

      await db.update(campaigns).set(updateData).where(inArray(campaigns.id, ids))

      if (status === 'stopped' && end_date) {
        for (const id of ids) {
          await db.update(budgetPeriods).set({ end_date }).where(
            and(eq(budgetPeriods.campaign_id, id), isNull(budgetPeriods.end_date))
          )
        }
      }

      // Changelog for each campaign
      for (const id of ids) {
        await db.insert(changelog).values({
          campaign_id: id,
          action: 'status_change',
          description: `סטטוס שונה ל${statusLabels[status] ?? status} (פעולה מרובה)`,
          new_value: status,
          performed_by: user.name,
        })
      }

      return json(res, { success: true, action: 'status', affected: ids.length })
    }

    // Bulk delete
    if (action === 'delete') {
      for (const id of ids) {
        await db.delete(campaigns).where(eq(campaigns.id, id))
      }

      return json(res, { success: true, action: 'delete', affected: ids.length })
    }

    // Bulk update ad_link
    if (action === 'update_ad_link') {
      const { ad_link } = body
      if (ad_link === undefined) return error(res, 'ad_link is required')

      await db.update(campaigns).set({ ad_link }).where(inArray(campaigns.id, ids))

      for (const id of ids) {
        await db.insert(changelog).values({
          campaign_id: id,
          action: 'note_added',
          description: `לינק מודעה עודכן (פעולה מרובה)`,
          new_value: ad_link,
          performed_by: user.name,
        })
      }

      return json(res, { success: true, action: 'update_ad_link', affected: ids.length })
    }

    // Bulk remove from plan
    if (action === 'remove_from_plan') {
      const { effective_date } = body
      if (!effective_date) return error(res, 'effective_date is required')

      for (const id of ids) {
        await db.update(budgetPeriods).set({ end_date: effective_date }).where(
          and(eq(budgetPeriods.campaign_id, id), isNull(budgetPeriods.end_date))
        )
      }

      await db.update(campaigns).set({ end_date: effective_date }).where(inArray(campaigns.id, ids))

      for (const id of ids) {
        await db.insert(changelog).values({
          campaign_id: id,
          action: 'campaign_removed',
          description: `קמפיין הוצא מתוכנית התקציב החל מ-${effective_date} (פעולה מרובה)`,
          new_value: effective_date,
          performed_by: user.name,
        })
      }

      return json(res, { success: true, action: 'remove_from_plan', affected: ids.length })
    }

    return error(res, `Unknown action: ${action}`)
  } catch (err) {
    console.error('Bulk action error:', err)
    return error(res, 'Internal server error', 500)
  }
}
