import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb } from '../_lib/db.js'
import { clients, syncLogs } from '../_lib/schema.js'
import { syncMetaForClient } from '../_lib/meta-sync-core.js'
import { syncGoogleForClient } from '../_lib/google-sync-core.js'

export const config = { maxDuration: 300 }

interface PlatformResult {
  success: boolean
  created?: number
  updated?: number
  error?: string
  duration_ms: number
}

interface SyncResult {
  client_id: string
  client_name: string
  meta?: PlatformResult
  google?: PlatformResult
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const db = getDb()
  const runStartedAt = Date.now()

  try {
    const activeClients = await db
      .select()
      .from(clients)
      .where(eq(clients.is_active, true))

    const results: SyncResult[] = []
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN

    for (const client of activeClients) {
      const result: SyncResult = {
        client_id: client.id,
        client_name: client.name,
      }

      if (client.meta_ad_account_id) {
        const startedAt = Date.now()
        if (!accessToken) {
          result.meta = {
            success: false,
            error: 'FACEBOOK_ACCESS_TOKEN not configured',
            duration_ms: 0,
          }
          await db.insert(syncLogs).values({
            client_id: client.id,
            platform: 'meta',
            status: 'error',
            error: 'FACEBOOK_ACCESS_TOKEN not configured',
            duration_ms: 0,
            triggered_by: 'cron',
          })
        } else {
          try {
            const r = await syncMetaForClient(db, client.id, null, accessToken)
            const duration_ms = Date.now() - startedAt
            result.meta = {
              success: true,
              created: r.created,
              updated: r.updated,
              duration_ms,
            }
            await db.insert(syncLogs).values({
              client_id: client.id,
              platform: 'meta',
              status: 'success',
              created_count: r.created,
              updated_count: r.updated,
              duration_ms,
              triggered_by: 'cron',
            })
          } catch (err) {
            const duration_ms = Date.now() - startedAt
            const message = (err as Error).message
            console.error(`[cron] Meta sync failed for ${client.name}:`, err)
            result.meta = { success: false, error: message, duration_ms }
            try {
              await db.insert(syncLogs).values({
                client_id: client.id,
                platform: 'meta',
                status: 'error',
                error: message,
                duration_ms,
                triggered_by: 'cron',
              })
            } catch (logErr) {
              console.error('Failed to write sync log:', logErr)
            }
          }
        }
      }

      if (client.google_customer_id) {
        const startedAt = Date.now()
        try {
          const r = await syncGoogleForClient(db, client.id, null, null)
          const duration_ms = Date.now() - startedAt
          result.google = {
            success: true,
            created: r.created,
            updated: r.updated,
            duration_ms,
          }
          await db.insert(syncLogs).values({
            client_id: client.id,
            platform: 'google',
            status: 'success',
            created_count: r.created,
            updated_count: r.updated,
            duration_ms,
            triggered_by: 'cron',
          })
        } catch (err) {
          const duration_ms = Date.now() - startedAt
          const message = (err as Error).message
          console.error(`[cron] Google sync failed for ${client.name}:`, err)
          result.google = { success: false, error: message, duration_ms }
          try {
            await db.insert(syncLogs).values({
              client_id: client.id,
              platform: 'google',
              status: 'error',
              error: message,
              duration_ms,
              triggered_by: 'cron',
            })
          } catch (logErr) {
            console.error('Failed to write sync log:', logErr)
          }
        }
      }

      results.push(result)
    }

    const metaSynced = results.filter(r => r.meta?.success).length
    const googleSynced = results.filter(r => r.google?.success).length
    const failed = results.filter(r =>
      (r.meta && !r.meta.success) || (r.google && !r.google.success)
    ).length

    return res.status(200).json({
      success: true,
      total_clients: activeClients.length,
      meta_synced: metaSynced,
      google_synced: googleSynced,
      failed,
      total_duration_ms: Date.now() - runStartedAt,
      results,
      synced_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Daily sync cron error:', err)
    return res.status(500).json({ error: `Cron sync failed: ${(err as Error).message}` })
  }
}
