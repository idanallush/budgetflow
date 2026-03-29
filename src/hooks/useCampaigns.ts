import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { demoCampaigns, demoBudgetPeriods } from '@/lib/demo-data'
import { enrichCampaignWithBudget } from '@/lib/forecast'
import { getAuthHeaders, getToken } from '@/hooks/useAuth'
import type { Campaign, CampaignWithBudget, CampaignStatus, BudgetPeriod } from '@/types'

const isDemoMode = () => !getToken()

export const useCampaigns = (clientId: string) => {
  return useQuery({
    queryKey: ['campaigns', clientId],
    queryFn: async (): Promise<CampaignWithBudget[]> => {
      if (isDemoMode()) {
        const campaigns = demoCampaigns.filter((c) => c.client_id === clientId)
        return campaigns.map((campaign) => {
          const periods = demoBudgetPeriods.filter((p) => p.campaign_id === campaign.id)
          return enrichCampaignWithBudget(campaign, periods)
        })
      }

      const res = await fetch(`/api/campaigns?client_id=${clientId}`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error('Failed to fetch campaigns')

      const data = await res.json() as { campaigns: Campaign[]; budget_periods: BudgetPeriod[] }

      return data.campaigns.map((campaign) => {
        const periods = data.budget_periods
          .filter((p) => p.campaign_id === campaign.id)
          .map((p) => ({ ...p, daily_budget: Number(p.daily_budget) }))
        return enrichCampaignWithBudget(campaign, periods)
      })
    },
    enabled: !!clientId,
  })
}

export const useCreateCampaign = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      client_id: string
      name: string
      technical_name?: string
      platform: 'facebook' | 'google'
      campaign_type?: string
      daily_budget: number
      start_date: string
      ad_link?: string
      notes?: string
    }) => {
      if (isDemoMode()) {
        const newCampaign: Campaign = {
          id: crypto.randomUUID(),
          client_id: input.client_id,
          name: input.name,
          technical_name: input.technical_name ?? null,
          platform: input.platform,
          campaign_type: input.campaign_type ?? null,
          ad_link: input.ad_link ?? null,
          status: 'active',
          start_date: input.start_date,
          end_date: null,
          notes: input.notes ?? null,
          created_at: new Date().toISOString(),
        }
        demoCampaigns.push(newCampaign)
        demoBudgetPeriods.push({
          id: crypto.randomUUID(),
          campaign_id: newCampaign.id,
          daily_budget: input.daily_budget,
          start_date: input.start_date,
          end_date: null,
          created_by: null,
          created_at: new Date().toISOString(),
        })
        return newCampaign
      }

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      })

      if (!res.ok) throw new Error('Failed to create campaign')
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', variables.client_id] })
    },
  })
}

export const useUpdateBudget = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      campaign_id: string
      client_id: string
      new_budget: number
      effective_date: string
      old_budget: number
    }) => {
      if (isDemoMode()) {
        const currentPeriod = demoBudgetPeriods.find(
          (p) => p.campaign_id === input.campaign_id && !p.end_date
        )
        if (currentPeriod) {
          const endDate = new Date(input.effective_date)
          endDate.setDate(endDate.getDate() - 1)
          currentPeriod.end_date = endDate.toISOString().split('T')[0]
        }
        demoBudgetPeriods.push({
          id: crypto.randomUUID(),
          campaign_id: input.campaign_id,
          daily_budget: input.new_budget,
          start_date: input.effective_date,
          end_date: null,
          created_by: null,
          created_at: new Date().toISOString(),
        })
        return
      }

      const res = await fetch(`/api/campaigns/${input.campaign_id}/budget`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          new_budget: input.new_budget,
          effective_date: input.effective_date,
          old_budget: input.old_budget,
        }),
      })

      if (!res.ok) throw new Error('Failed to update budget')
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', variables.client_id] })
    },
  })
}

export const useUpdateCampaignStatus = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      campaign_id: string
      client_id: string
      status: CampaignStatus
      end_date?: string
    }) => {
      if (isDemoMode()) {
        const campaign = demoCampaigns.find((c) => c.id === input.campaign_id)
        if (campaign) {
          campaign.status = input.status
          if (input.end_date) campaign.end_date = input.end_date
          if (input.status === 'stopped') {
            const period = demoBudgetPeriods.find(
              (p) => p.campaign_id === input.campaign_id && !p.end_date
            )
            if (period) period.end_date = input.end_date ?? new Date().toISOString().split('T')[0]
          }
        }
        return
      }

      const res = await fetch(`/api/campaigns/${input.campaign_id}/status`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: input.status,
          end_date: input.end_date,
        }),
      })

      if (!res.ok) throw new Error('Failed to update campaign status')
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', variables.client_id] })
    },
  })
}

export const useDeleteCampaign = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { campaign_id: string; client_id: string }) => {
      if (isDemoMode()) {
        const idx = demoCampaigns.findIndex((c) => c.id === input.campaign_id)
        if (idx !== -1) demoCampaigns.splice(idx, 1)
        return
      }

      const res = await fetch(`/api/campaigns/${input.campaign_id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (!res.ok) throw new Error('Failed to delete campaign')
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', variables.client_id] })
    },
  })
}
