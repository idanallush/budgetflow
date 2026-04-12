import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb } from '../_lib/db.js'
import { clients } from '../_lib/schema.js'

interface SyncResult {
  client_id: string
  client_name: string
  meta?: { success: boolean; created?: number; updated?: number; error?: string }
  google?: { success: boolean; created?: number; updated?: number; error?: string }
}

async function syncMeta(clientId: string, adAccountId: string): Promise<SyncResult['meta']> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  try {
    const res = await fetch(`${baseUrl}/api/meta/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, ad_account_id: adAccountId }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: text }
    }

    const data = await res.json() as { created: number; updated: number }
    return { success: true, created: data.created, updated: data.updated }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

async function syncGoogle(
  clientId: string,
  googleCustomerId: string,
  googleMccId: string | null
): Promise<SyncResult['google']> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  try {
    const res = await fetch(`${baseUrl}/api/google/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        google_customer_id: googleCustomerId,
        google_mcc_id: googleMccId,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: text }
    }

    const data = await res.json() as { created: number; updated: number }
    return { success: true, created: data.created, updated: data.updated }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET (Vercel Cron sends GET requests)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify Vercel Cron secret
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const db = getDb()

    // Get all active clients
    const activeClients = await db
      .select()
      .from(clients)
      .where(eq(clients.is_active, true))

    const results: SyncResult[] = []

    for (const client of activeClients) {
      const result: SyncResult = {
        client_id: client.id,
        client_name: client.name,
      }

      // Meta sync
      if (client.meta_ad_account_id) {
        result.meta = await syncMeta(client.id, client.meta_ad_account_id)
      }

      // Google sync
      if (client.google_customer_id) {
        result.google = await syncGoogle(
          client.id,
          client.google_customer_id,
          client.google_mcc_id
        )
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
      results,
      synced_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Daily sync cron error:', err)
    return res.status(500).json({ error: `Cron sync failed: ${(err as Error).message}` })
  }
}
