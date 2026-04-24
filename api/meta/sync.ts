import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../_lib/db.js'
import { syncLogs } from '../_lib/schema.js'
import { syncMetaForClient } from '../_lib/meta-sync-core.js'
import { json, error, methodNotAllowed, handleCors } from '../_lib/api-helpers.js'

export const config = { maxDuration: 300 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res)

  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN
  if (!accessToken) return error(res, 'FACEBOOK_ACCESS_TOKEN not configured', 500)

  const { client_id, ad_account_id } = req.body ?? {}
  if (!client_id) return error(res, 'client_id is required')

  const db = getDb()
  const startedAt = Date.now()

  try {
    const result = await syncMetaForClient(db, client_id, ad_account_id ?? null, accessToken)

    await db.insert(syncLogs).values({
      client_id,
      platform: 'meta',
      status: 'success',
      created_count: result.created,
      updated_count: result.updated,
      duration_ms: Date.now() - startedAt,
      triggered_by: 'manual',
    })

    return json(res, result)
  } catch (err) {
    const message = (err as Error).message
    console.error('Meta sync error:', err)

    try {
      await db.insert(syncLogs).values({
        client_id,
        platform: 'meta',
        status: 'error',
        error: message,
        duration_ms: Date.now() - startedAt,
        triggered_by: 'manual',
      })
    } catch (logErr) {
      console.error('Failed to write sync log:', logErr)
    }

    return error(res, `Sync failed: ${message}`, 500)
  }
}
