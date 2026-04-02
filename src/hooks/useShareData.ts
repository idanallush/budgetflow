import { useQuery } from '@tanstack/react-query'
import { enrichCampaignWithBudget } from '@/lib/forecast'
import type { Client, Campaign, BudgetPeriod, CampaignWithBudget } from '@/types'

interface ShareData {
  client: Client
  campaigns: CampaignWithBudget[]
}

function adjustStaleSpend(campaign: Campaign): Campaign {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  if (campaign.actual_spend_month === currentMonth) return campaign
  return { ...campaign, actual_spend: 0 }
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

      const data = await res.json() as {
        client: Client
        campaigns: Campaign[]
        budget_periods: BudgetPeriod[]
      }

      const enrichedCampaigns = data.campaigns.map((campaign) => {
        const periods = data.budget_periods
          .filter((p) => p.campaign_id === campaign.id)
          .map((p) => ({ ...p, daily_budget: Number(p.daily_budget) }))
        return enrichCampaignWithBudget(adjustStaleSpend(campaign), periods)
      })

      return { client: data.client, campaigns: enrichedCampaigns }
    },
    enabled: !!token,
  })
}
