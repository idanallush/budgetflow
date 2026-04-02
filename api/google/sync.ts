import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb } from '../_lib/db.js'
import { clients, campaigns, changelog } from '../_lib/schema.js'
import { json, error, methodNotAllowed, handleCors } from '../_lib/api-helpers.js'

const GOOGLE_ADS_API_VERSION = 'v23'

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to get Google access token: ${err}`)
  }

  const data = await res.json() as GoogleTokenResponse
  return data.access_token
}

async function queryGoogleAds(
  customerId: string,
  accessToken: string,
  query: string,
  loginCustomerId: string
): Promise<Record<string, unknown>[]> {
  const cleanCustomerId = customerId.replace(/-/g, '')

  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cleanCustomerId}/googleAds:searchStream`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      'login-customer-id': loginCustomerId,
    },
    body: JSON.stringify({ query }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Ads API error: ${err}`)
  }

  const data = await res.json()
  // searchStream returns array of batches, each with results
  const results: Record<string, unknown>[] = []
  if (Array.isArray(data)) {
    for (const batch of data) {
      if (batch.results) {
        results.push(...(batch.results as Record<string, unknown>[]))
      }
    }
  }
  return results
}

function mapGoogleStatus(status: string): 'active' | 'paused' | 'stopped' {
  switch (status) {
    case 'ENABLED': return 'active'
    case 'PAUSED': return 'paused'
    default: return 'stopped'
  }
}

function formatGoogleDate(dateStr: string | undefined): string | null {
  if (!dateStr || dateStr === '2037-12-30') return null
  return dateStr
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res)

  const requiredEnvVars = [
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REFRESH_TOKEN',
  ]
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      return error(res, `${envVar} not configured`, 500)
    }
  }

  const { client_id, google_customer_id, google_mcc_id } = req.body ?? {}
  if (!client_id) return error(res, 'client_id is required')

  try {
    const db = getDb()

    const [client] = await db.select().from(clients).where(eq(clients.id, client_id)).limit(1)
    if (!client) return error(res, 'Client not found', 404)

    // Determine Customer ID
    let customerId = client.google_customer_id
    if (google_customer_id) {
      const cleaned = google_customer_id.replace(/-/g, '')
      await db.update(clients).set({ google_customer_id: cleaned }).where(eq(clients.id, client_id))
      customerId = cleaned
    }
    if (!customerId) return error(res, 'No Google Ads Customer ID configured for this client')

    // Determine MCC ID (login-customer-id) — per client, fallback to env
    let mccId = client.google_mcc_id
    if (google_mcc_id) {
      const cleanedMcc = google_mcc_id.replace(/-/g, '')
      await db.update(clients).set({ google_mcc_id: cleanedMcc }).where(eq(clients.id, client_id))
      mccId = cleanedMcc
    }
    if (!mccId) {
      mccId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || null
    }
    if (!mccId) return error(res, 'No Google MCC ID configured for this client')

    const accessToken = await getAccessToken()

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const today = now.toISOString().split('T')[0]

    // GAQL: campaigns with impressions this month
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.cost_micros,
        metrics.impressions
      FROM campaign
      WHERE segments.date BETWEEN '${monthStart}' AND '${today}'
        AND metrics.impressions > 0
    `

    const rows = await queryGoogleAds(customerId, accessToken, query, mccId)

    // Aggregate per campaign (rows are per-day due to segments.date)
    const campaignMap = new Map<string, {
      id: string
      name: string
      status: string
      startDate: string | null
      endDate: string | null
      totalCostMicros: number
      totalImpressions: number
    }>()

    for (const row of rows) {
      const c = row.campaign as Record<string, string>
      const m = row.metrics as Record<string, string>
      const cId = c.id

      const existing = campaignMap.get(cId)
      if (existing) {
        existing.totalCostMicros += Number(m.costMicros || 0)
        existing.totalImpressions += Number(m.impressions || 0)
      } else {
        campaignMap.set(cId, {
          id: cId,
          name: c.name,
          status: c.status,
          startDate: null,
          endDate: null,
          totalCostMicros: Number(m.costMicros || 0),
          totalImpressions: Number(m.impressions || 0),
        })
      }
    }

    // Existing Google campaigns for this client
    const existingCampaigns = await db.select().from(campaigns).where(eq(campaigns.client_id, client_id))
    const googleIdMap = new Map(
      existingCampaigns
        .filter(c => c.meta_campaign_id && c.platform === 'google')
        .map(c => [c.meta_campaign_id!, c])
    )

    let created = 0
    let updated = 0

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    for (const [, gc] of campaignMap) {
      const spend = Math.round((gc.totalCostMicros / 1_000_000) * 100) / 100
      const status = mapGoogleStatus(gc.status)
      const googleAdLink = `https://ads.google.com/aw/campaigns?campaignId=${gc.id}&ocid=${customerId}`

      const existing = googleIdMap.get(gc.id)

      if (existing) {
        await db.update(campaigns).set({
          actual_spend: String(spend),
          actual_spend_month: currentMonth,
          status,
          ad_link: googleAdLink,
          last_synced_at: now,
        }).where(eq(campaigns.id, existing.id))
        updated++
      } else {
        const startDate = today

        const [newCampaign] = await db.insert(campaigns).values({
          client_id,
          name: gc.name,
          technical_name: gc.name,
          platform: 'google',
          campaign_type: null,
          meta_campaign_id: gc.id,
          actual_spend: String(spend),
          actual_spend_month: currentMonth,
          status,
          start_date: startDate,
          end_date: gc.endDate,
          ad_link: googleAdLink,
          last_synced_at: now,
        }).returning()

        await db.insert(changelog).values({
          campaign_id: newCampaign.id,
          action: 'campaign_added',
          description: `קמפיין סונכרן מ-Google Ads: ${gc.name}`,
          performed_by: 'Google Sync',
        })

        created++
      }
    }

    return json(res, {
      success: true,
      google_customer_id: customerId,
      total_campaigns: campaignMap.size,
      created,
      updated,
      synced_at: now.toISOString(),
    })
  } catch (err) {
    console.error('Google sync error:', err)
    return error(res, `Sync failed: ${(err as Error).message}`, 500)
  }
}
