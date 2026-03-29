import { ExternalLink, History, MoreHorizontal } from 'lucide-react'
import type { CampaignWithBudget, Platform } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PlatformIcon } from '@/components/ui/PlatformIcon'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/format'

interface CampaignTableProps {
  campaigns: CampaignWithBudget[]
  platform: Platform
  onEditCampaign: (campaign: CampaignWithBudget) => void
  onViewChangelog: (campaignId: string) => void
  onBudgetEdit: (campaign: CampaignWithBudget) => void
}

const platformLabels: Record<Platform, string> = {
  facebook: 'Meta (Facebook)',
  google: 'Google Ads',
}

export const CampaignTable = ({
  campaigns,
  platform,
  onEditCampaign,
  onViewChangelog,
  onBudgetEdit,
}: CampaignTableProps) => {
  const platformCampaigns = campaigns.filter((c) => c.platform === platform)

  if (platformCampaigns.length === 0) return null

  const totalDaily = platformCampaigns.reduce((sum, c) => sum + c.current_daily_budget, 0)
  const totalForecast = platformCampaigns.reduce((sum, c) => sum + c.monthly_forecast, 0)
  const totalOriginal = platformCampaigns.reduce((sum, c) => sum + c.original_plan, 0)
  const totalVariance = totalForecast - totalOriginal

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3 px-1">
        <PlatformIcon platform={platform} size={20} />
        <h3 className="text-lg font-semibold leading-tight">
          {platformLabels[platform]}
        </h3>
        <span className="chip text-xs">{platformCampaigns.length} קמפיינים</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.08)]">
        <table className="glass-table">
          <thead>
            <tr>
              <th>קמפיין</th>
              <th>סטטוס</th>
              <th>תקציב יומי</th>
              <th>תחזית חודשית</th>
              <th>תוכנית מקורית</th>
              <th>סטייה</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {platformCampaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td>
                  <div className="flex flex-col">
                    <span className="font-medium">{campaign.name}</span>
                    {campaign.campaign_type && (
                      <span className="text-xs text-text-muted">{campaign.campaign_type}</span>
                    )}
                  </div>
                </td>
                <td>
                  <StatusBadge status={campaign.status} />
                </td>
                <td>
                  <button
                    className="font-semibold text-accent hover:underline cursor-pointer bg-transparent border-none p-0"
                    onClick={() => onBudgetEdit(campaign)}
                  >
                    {formatCurrency(campaign.current_daily_budget)}
                  </button>
                </td>
                <td className="font-semibold">
                  {formatCurrency(campaign.monthly_forecast)}
                </td>
                <td className="text-text-secondary">
                  {formatCurrency(campaign.original_plan)}
                </td>
                <td>
                  {campaign.variance !== 0 && (
                    <span
                      className={`chip text-xs ${
                        campaign.variance > 0 ? 'status-stopped' : 'status-active'
                      }`}
                    >
                      {campaign.variance > 0 ? '+' : ''}
                      {formatCurrency(campaign.variance)}
                    </span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    {campaign.ad_link && (
                      <a
                        href={campaign.ad_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-icon !w-8 !h-8"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <Button
                      variant="icon"
                      className="!w-8 !h-8"
                      onClick={() => onViewChangelog(campaign.id)}
                    >
                      <History size={14} />
                    </Button>
                    <Button
                      variant="icon"
                      className="!w-8 !h-8"
                      onClick={() => onEditCampaign(campaign)}
                    >
                      <MoreHorizontal size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Summary row */}
            <tr className="summary-row">
              <td>סה״כ {platformLabels[platform]}</td>
              <td></td>
              <td className="font-semibold">{formatCurrency(totalDaily)}</td>
              <td className="font-semibold">{formatCurrency(totalForecast)}</td>
              <td className="text-text-secondary">{formatCurrency(totalOriginal)}</td>
              <td>
                {totalVariance !== 0 && (
                  <span
                    className={`chip text-xs ${
                      totalVariance > 0 ? 'status-stopped' : 'status-active'
                    }`}
                  >
                    {totalVariance > 0 ? '+' : ''}
                    {formatCurrency(totalVariance)}
                  </span>
                )}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
