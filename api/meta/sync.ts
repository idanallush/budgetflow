import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { getDb } from '../_lib/db.js'
import { clients, campaigns, changelog } from '../_lib/schema.js'
import { json, error, methodNotAllowed, handleCors } from '../_lib/api-helpers.js'

const META_API_VERSION = 'v21.0'
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

interface MetaCampaign {
  id: string
  name: string
  status: string
  objective: string
  start_time?: string
  stop_time?: string
}

interface MetaInsight {
  campaign_id: string
  campaign_name: string
  spend: string
  impressions: string
  date_start: string
  date_stop: string
}

async function fetchMonthlyInsights(adAccountId: string, accessToken: string): Promise<MetaInsight[]> {
  const now = new Date()
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = now.toISOString().split('T')[0]

  const url = `${META_BASE_URL}/${adAccountId}/insights?fields=campaign_id,campaign_name,spend,impressions&level=campaign&time_range={"since":"${firstDay}","until":"${today}"}&limit=500&access_token=${accessToken}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta Insights API error: ${JSON.stringify(err)}`)
  }
  const data = await res.json()
  return data.data ?? []
}

async function fetchCampaignDetails(campaignIds: string[], accessToken: string): Promise<MetaCampaign[]> {
  const results: MetaCampaign[] = []

  for (let i = 0; i < campaignIds.length; i += 50) {
    const chunk = campaignIds.slice(i, i + 50)
    const ids = chunk.join(',')
    const url = `${META_BASE_URL}/?ids=${ids}&fields=id,name,status,objective,start_time,stop_time&access_token=${accessToken}`
    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.json()
      throw new Error(`Meta API error: ${JSON.stringify(err)}`)
    }
    const data = await res.json() as Record<string, MetaCampaign>
    for (const id of chunk) {
      if (data[id]) results.push(data[id])
    }
  }

  return results
}

function buildCampaignAdLink(campaignId: string, adAccountId: string): string {
  const accountNum = adAccountId.replace('act_', '')
  return `https://www.facebook.com/adsmanager/manage/ads?act=${accountNum}&campaign_ids=${campaignId}`
}

function mapMetaStatus(metaStatus: string): 'active' | 'paused' | 'stopped' {
  switch (metaStatus) {
    case 'ACTIVE': return 'active'
    case 'PAUSED': return 'paused'
    default: return 'stopped'
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return methodNotAllowed(res)

  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN
  if (!accessToken) return error(res, 'FACEBOOK_ACCESS_TOKEN not configured', 500)

  const { client_id, ad_account_id } = req.body ?? {}
  if (!client_id) return error(res, 'client_id is required')

  try {
    const db = getDb()

    const [client] = await db.select().from(clients).where(eq(clients.id, client_id)).limit(1)
    if (!client) return error(res, 'Client not found', 404)

    let accountId = client.meta_ad_account_id
    if (ad_account_id) {
      const formatted = ad_account_id.startsWith('act_') ? ad_account_id : `act_${ad_account_id}`
      await db.update(clients).set({ meta_ad_account_id: formatted }).where(eq(clients.id, client_id))
      accountId = formatted
    }
    if (!accountId) return error(res, 'No Meta Ad Account ID configured for this client')

    const now = new Date()

    const monthlyInsights = await fetchMonthlyInsights(accountId, accessToken)

    const activeInsights = monthlyInsights.filter(
      (i) => Number(i.spend) > 0 || Number(i.impressions) > 0
    )

    if (activeInsights.length === 0) {
      return json(res, {
        success: true,
        ad_account_id: accountId,
        total_meta_campaigns: 0,
        created: 0,
        updated: 0,
        synced_at: now.toISOString(),
        message: 'No campaigns with activity this month',
      })
    }

    const spendMap = new Map<string, number>()
    for (const insight of activeInsights) {
      spendMap.set(insight.campaign_id, Number(insight.spend) || 0)
    }

    const activeCampaignIds = activeInsights.map((i) => i.campaign_id)
    const metaCampaigns = await fetchCampaignDetails(activeCampaignIds, accessToken)

    const existingCampaigns = await db.select().from(campaigns).where(eq(campaigns.client_id, client_id))
    const metaIdMap = new Map(existingCampaigns.filter(c => c.meta_campaign_id).map(c => [c.meta_campaign_id!, c]))

    let created = 0
    let updated = 0

    for (const mc of metaCampaigns) {
      const spend = spendMap.get(mc.id) ?? 0
      const status = mapMetaStatus(mc.status)
      const adLink = buildCampaignAdLink(mc.id, accountId)

      const existing = metaIdMap.get(mc.id)

      if (existing) {
        await db.update(campaigns).set({
          actual_spend: String(spend),
          status,
          ad_link: adLink,
          last_synced_at: now,
        }).where(eq(campaigns.id, existing.id))
        updated++
      } else {
        const startDate = mc.start_time ? mc.start_time.split('T')[0] : now.toISOString().split('T')[0]
        const endDate = mc.stop_time ? mc.stop_time.split('T')[0] : null

        const [newCampaign] = await db.insert(campaigns).values({
          client_id,
          name: mc.name,
          technical_name: mc.name,
          platform: 'facebook',
          campaign_type: mc.objective || null,
          meta_campaign_id: mc.id,
          actual_spend: String(spend),
          ad_link: adLink,
          status,
          start_date: startDate,
          end_date: endDate,
          last_synced_at: now,
        }).returning()

        await db.insert(changelog).values({
          campaign_id: newCampaign.id,
          action: 'campaign_added',
          description: `קמפיין סונכרן מ-Meta: ${mc.name}`,
          performed_by: 'Meta Sync',
        })

        created++
      }
    }

    return json(res, {
      success: true,
      ad_account_id: accountId,
      total_meta_campaigns: metaCampaigns.length,
      created,
      updated,
      synced_at: now.toISOString(),
    })
  } catch (err) {
    console.error('Meta sync error:', err)
    return error(res, `Sync failed: ${(err as Error).message}`, 500)
  }
}
