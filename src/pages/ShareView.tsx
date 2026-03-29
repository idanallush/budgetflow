import { useParams } from 'react-router-dom'
import { useClientByShareToken } from '@/hooks/useClients'
import { useCampaigns } from '@/hooks/useCampaigns'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PlatformIcon } from '@/components/ui/PlatformIcon'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatCurrency } from '@/lib/format'
import type { CampaignWithBudget, Platform } from '@/types'

const platformLabels: Record<Platform, string> = {
  facebook: 'Meta (Facebook)',
  google: 'Google Ads',
}

const ShareTable = ({ campaigns, platform }: { campaigns: CampaignWithBudget[]; platform: Platform }) => {
  const filtered = campaigns.filter((c) => c.platform === platform)
  if (filtered.length === 0) return null

  const totalDaily = filtered.reduce((sum, c) => sum + c.current_daily_budget, 0)
  const totalForecast = filtered.reduce((sum, c) => sum + c.monthly_forecast, 0)

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3 px-1">
        <PlatformIcon platform={platform} size={20} />
        <h3 className="text-lg font-semibold leading-tight">{platformLabels[platform]}</h3>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.08)]">
        <table className="glass-table">
          <thead>
            <tr>
              <th>קמפיין</th>
              <th>סטטוס</th>
              <th>תקציב יומי</th>
              <th>תחזית חודשית</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((campaign) => (
              <tr key={campaign.id}>
                <td className="font-medium">{campaign.name}</td>
                <td><StatusBadge status={campaign.status} /></td>
                <td>{formatCurrency(campaign.current_daily_budget)}</td>
                <td className="font-semibold">{formatCurrency(campaign.monthly_forecast)}</td>
              </tr>
            ))}
            <tr className="summary-row">
              <td>סה״כ {platformLabels[platform]}</td>
              <td></td>
              <td className="font-semibold">{formatCurrency(totalDaily)}</td>
              <td className="font-semibold">{formatCurrency(totalForecast)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const ShareView = () => {
  const { token } = useParams<{ token: string }>()
  const { data: client, isLoading: clientLoading } = useClientByShareToken(token ?? '')
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(client?.id ?? '')

  const isLoading = clientLoading || campaignsLoading

  const totalForecast = campaigns?.reduce((sum, c) => sum + c.monthly_forecast, 0) ?? 0
  const totalDaily = campaigns?.reduce((sum, c) => sum + c.current_daily_budget, 0) ?? 0

  const now = new Date()
  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
  ]

  if (!isLoading && !client) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <GlassPanel className="p-8 text-center max-w-md">
          <p className="text-lg text-text-secondary">הקישור אינו תקף או שפג תוקפו</p>
        </GlassPanel>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <span className="text-white text-sm font-semibold">B</span>
              </div>
              <span className="text-sm text-text-muted">Bright Agency</span>
            </div>
            <h1 className="text-2xl font-semibold leading-tight">
              {client?.name ?? '...'}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              תחזית תקציב — {monthNames[now.getMonth()]} {now.getFullYear()}
            </p>
          </div>

          <div className="text-end">
            <p className="text-xs text-text-muted mb-1">תחזית חודשית כוללת</p>
            <p className="text-3xl font-semibold text-accent">{formatCurrency(totalForecast)}</p>
            <p className="text-sm text-text-secondary mt-1">
              {formatCurrency(totalDaily)} / יום
            </p>
          </div>
        </div>

        {/* Tables */}
        <GlassPanel className="p-6 animate-enter">
          {isLoading ? (
            <div className="flex flex-col gap-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <>
              <ShareTable campaigns={campaigns ?? []} platform="facebook" />
              <ShareTable campaigns={campaigns ?? []} platform="google" />

              {/* Grand Total */}
              {campaigns && campaigns.length > 0 && (
                <div className="glass-card p-5 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-lg">סה״כ כללי</span>
                    <div className="flex items-center gap-6">
                      <div className="text-end">
                        <p className="text-xs text-text-muted">יומי</p>
                        <p className="font-semibold">{formatCurrency(totalDaily)}</p>
                      </div>
                      <div className="text-end">
                        <p className="text-xs text-text-muted">חודשי</p>
                        <p className="text-2xl font-semibold text-accent">{formatCurrency(totalForecast)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </GlassPanel>

        <footer className="text-center text-xs py-6" style={{ color: 'var(--color-text-muted)' }}>
          BudgetFlow — Bright Agency &copy; {now.getFullYear()}
        </footer>
      </div>
    </div>
  )
}
