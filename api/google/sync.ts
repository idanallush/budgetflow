import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../_lib/db.js'
import { syncLogs } from '../_lib/schema.js'
import { syncGoogleForClient } from '../_lib/google-sync-core.js'
import { json, error, methodNotAllowed, handleCors } from '../_lib/api-helpers.js'

export const config = { maxDuration: 300 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res)

  const { client_id, google_customer_id, google_mcc_id } = req.body ?? {}
  if (!client_id) return error(res, 'client_id is required')

  const db = getDb()
  const startedAt = Date.now()

  try {
    const result = await syncGoogleForClient(
      db,
      client_id,
      google_customer_id ?? null,
      google_mcc_id ?? null
    )

    await db.insert(syncLogs).values({
      client_id,
      platform: 'google',
      status: 'success',
      created_count: result.created,
      updated_count: result.updated,
      duration_ms: Date.now() - startedAt,
      triggered_by: 'manual',
    })

    return json(res, result)
  } catch (err) {
    const message = (err as Error).message
    console.error('Google sync error:', err)

    try {
      await db.insert(syncLogs).values({
        client_id,
        platform: 'google',
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
