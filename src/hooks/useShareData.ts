import { useQuery } from '@tanstack/react-query'
import { enrichCampaignWithBudget } from '@/lib/forecast'
import type { Client, Campaign, BudgetPeriod, CampaignWithBudget } from '@/types'

interface ShareData {
  client: Client
  campaigns: CampaignWithBudget[]
}

/**
 * Fetch all share data (client + campaigns + budget_periods) in a single API call.
 * Does not require authentication — the share token is the auth.
 */
export const useShareData = (token: string) => {
  return useQuery({
    queryKey: ['share', token],
    queryFn: async (): Promise<ShareData | null> => {
      const res = await fetch(`/api/share/${token}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed to fetch shared data')

      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const data = await res.json() as {
        client: Client
        campaigns: Campaign[]
        budget_periods: BudgetPeriod[]
      }

      const enrichedCampaigns = data.campaigns.map((campaign) => {
        const periods = data.budget_periods
          .filter((p) => p.campaign_id === campaign.id)
          .map((p) => ({ ...p, daily_budget: Number(p.daily_budget) }))

        const enriched = enrichCampaignWithBudget(campaign, periods)

        // Zero out stale actual_spend
        if (enriched.actual_spend_month && enriched.actual_spend_month !== currentMonth) {
          return { ...enriched, actual_spend: 0 }
        }
        if (!enriched.actual_spend_month && Number(enriched.actual_spend) > 0) {
          return { ...enriched, actual_spend: 0 }
        }

        return enriched
      })

      return { client: data.client, campaigns: enrichedCampaigns }
    },
    enabled: !!token,
  })
}
