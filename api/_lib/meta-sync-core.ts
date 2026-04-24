import { eq } from 'drizzle-orm'
import type { getDb } from './db.js'
import { campaigns, changelog, clients } from './schema.js'

const META_API_VERSION = 'v21.0'
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

type Db = ReturnType<typeof getDb>

export interface MetaSyncResult {
  success: true
  ad_account_id: string
  total_meta_campaigns: number
  created: number
  updated: number
  synced_at: string
  message?: string
}

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

async function fetchTopAdLink(
  campaignId: string,
  adAccountId: string,
  accessToken: string,
  monthStart: string,
  today: string
): Promise<string> {
  const accountNum = adAccountId.replace('act_', '')

  try {
    const insightsUrl = `${META_BASE_URL}/${campaignId}/insights?fields=ad_id&level=ad&time_range={"since":"${monthStart}","until":"${today}"}&sort=spend_descending&limit=1&access_token=${accessToken}`
    const insightsRes = await fetch(insightsUrl)

    if (!insightsRes.ok) {
      return `https://www.facebook.com/adsmanager/manage/ads?act=${accountNum}&campaign_ids=${campaignId}`
    }

    const insightsData = await insightsRes.json()
    const topAdId = insightsData.data?.[0]?.ad_id

    if (!topAdId) {
      return `https://www.facebook.com/adsmanager/manage/ads?act=${accountNum}&campaign_ids=${campaignId}`
    }

    const adUrl = `${META_BASE_URL}/${topAdId}?fields=preview_shareable_link&access_token=${accessToken}`
    const adRes = await fetch(adUrl)

    if (!adRes.ok) {
      return `https://www.facebook.com/adsmanager/manage/ads?act=${accountNum}&selected_ad_ids=${topAdId}`
    }

    const adData = await adRes.json()

    if (adData.preview_shareable_link) {
      return adData.preview_shareable_link
    }

    return `https://www.facebook.com/adsmanager/manage/ads?act=${accountNum}&selected_ad_ids=${topAdId}`
  } catch {
    return `https://www.facebook.com/adsmanager/manage/ads?act=${accountNum}&campaign_ids=${campaignId}`
  }
}

async function fetchActiveCampaigns(adAccountId: string, accessToken: string): Promise<MetaCampaign[]> {
  const url = `${META_BASE_URL}/${adAccountId}/campaigns?fields=id,name,status,objective,start_time,stop_time&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]&limit=500&access_token=${accessToken}`
  const res = await fetch(url)
  if (!res.ok) {
    console.warn('Failed to fetch active campaigns:', await res.text())
    return []
  }
  const data = await res.json()
  return data.data ?? []
}

function mapMetaStatus(metaStatus: string, startTime?: string): 'active' | 'paused' | 'stopped' | 'scheduled' {
  switch (metaStatus) {
    case 'ACTIVE':
      if (startTime && new Date(startTime) > new Date()) return 'scheduled'
      return 'active'
    case 'PAUSED': return 'paused'
    case 'SCHEDULED': return 'scheduled'
    default: return 'stopped'
  }
}

/**
 * Core Meta sync logic — usable from HTTP endpoint or cron.
 * Pass an already-formatted ad_account_id (with act_ prefix) when known;
 * otherwise pass null and the client's stored value will be used.
 */
export async function syncMetaForClient(
  db: Db,
  clientId: string,
  adAccountIdOverride: string | null,
  accessToken: string
): Promise<MetaSyncResult> {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1)
  if (!client) throw new Error('Client not found')

  let accountId = client.meta_ad_account_id
  if (adAccountIdOverride) {
    const formatted = adAccountIdOverride.startsWith('act_') ? adAccountIdOverride : `act_${adAccountIdOverride}`
    await db.update(clients).set({ meta_ad_account_id: formatted }).where(eq(clients.id, clientId))
    accountId = formatted
  }
  if (!accountId) throw new Error('No Meta Ad Account ID configured for this client')

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr = now.toISOString().split('T')[0]

  const monthlyInsights = await fetchMonthlyInsights(accountId, accessToken)

  const activeInsights = monthlyInsights.filter(
    (i) => Number(i.spend) > 0 || Number(i.impressions) > 0
  )

  const spendMap = new Map<string, number>()
  for (const insight of activeInsights) {
    spendMap.set(insight.campaign_id, Number(insight.spend) || 0)
  }

  const activeCampaignIds = activeInsights.map((i) => i.campaign_id)
  let metaCampaigns: MetaCampaign[] = []
  if (activeCampaignIds.length > 0) {
    metaCampaigns = await fetchCampaignDetails(activeCampaignIds, accessToken)
  }

  const activeCampaigns = await fetchActiveCampaigns(accountId, accessToken)
  const existingIds = new Set(metaCampaigns.map((c) => c.id))
  for (const ac of activeCampaigns) {
    if (!existingIds.has(ac.id)) {
      metaCampaigns.push(ac)
    }
  }

  if (metaCampaigns.length === 0) {
    return {
      success: true,
      ad_account_id: accountId,
      total_meta_campaigns: 0,
      created: 0,
      updated: 0,
      synced_at: now.toISOString(),
      message: 'No campaigns with activity or active/scheduled this month',
    }
  }

  const existingCampaigns = await db.select().from(campaigns).where(eq(campaigns.client_id, clientId))
  const metaIdMap = new Map(existingCampaigns.filter(c => c.meta_campaign_id).map(c => [c.meta_campaign_id!, c]))

  let created = 0
  let updated = 0

  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  for (const mc of metaCampaigns) {
    const spend = spendMap.get(mc.id) ?? 0
    const status = mapMetaStatus(mc.status, mc.start_time)
    const adLink = await fetchTopAdLink(mc.id, accountId, accessToken, monthStart, todayStr)

    const existing = metaIdMap.get(mc.id)

    if (existing) {
      await db.update(campaigns).set({
        actual_spend: String(spend),
        actual_spend_month: currentMonth,
        status,
        ad_link: adLink,
        last_synced_at: now,
      }).where(eq(campaigns.id, existing.id))
      updated++
    } else {
      const startDate = mc.start_time ? mc.start_time.split('T')[0] : todayStr
      const endDate = mc.stop_time ? mc.stop_time.split('T')[0] : null

      const [newCampaign] = await db.insert(campaigns).values({
        client_id: clientId,
        name: mc.name,
        technical_name: mc.name,
        platform: 'facebook',
        campaign_type: mc.objective || null,
        meta_campaign_id: mc.id,
        actual_spend: String(spend),
        actual_spend_month: currentMonth,
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

  return {
    success: true,
    ad_account_id: accountId,
    total_meta_campaigns: metaCampaigns.length,
    created,
    updated,
    synced_at: now.toISOString(),
  }
}
